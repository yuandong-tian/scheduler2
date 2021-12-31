import os
import sys
import json
import argparse
import re
from copy import deepcopy
from enum import Enum
from datetime import datetime, timedelta, time
from collections import defaultdict
from dateutil import parser 
import hashlib

gDefaultUser = os.environ["USER"]
gDefaultTag = "untagged"

class TimestampType(Enum):
    FROM_ABSOLUTE = 1
    FROM_RELATIVE = 2

class LabelParser:
    def __init__(self):
        self.time_diff_mapping = {
            "h": timedelta(hours=1),
            "d": timedelta(days=1),
            "w": timedelta(weeks=1),
            "m": timedelta(weeks=4)
        }
        self.matcher = re.compile("!([A-Z_]+)\[(.*?)\]")
        self.hashtag_matcher = re.compile(r"#([\d\w_-]+)")

    def _parse_time(self, value, start=None):
        # If the value end with a digit, then it is a absolute timestamp
        if value[-1].isdigit():
            try:
                return parser.parse(value), TimestampType.FROM_ABSOLUTE
            except parser._parser.ParserError:
                pass
            
        # Then try relative time difference
        time_type = TimestampType.FROM_RELATIVE
        if start is None:
            return start, time_type

        if value[0].isdigit():
            return start + self.time_diff_mapping[value[-1]] * float(value[:-1]), time_type 
        else:
            if value.lower() == "eod":
                return datetime.combine(start, time.max), time_type
            elif value.lower() == "eow":
                start_week = start - timedelta(days=start.weekday())
                end_week = start_week + timedelta(days=6)
                return end_week, time_type
            elif value.lower() == "eonw":
                start_week = start - timedelta(days=start.weekday())
                end_next_week = start_week + timedelta(days=7+6)
                return end_next_week, time_type
            else:
                raise RuntimeError(f"Time parse error! start={start}, value={value}") 

    def parse_labels(self, s):
        # Example: start=xxx,deadline=xxx,recur=xxx
        label = {}

        direct_keys = ["reason", "duration"]

        for i, item in enumerate(s.split(";")):
            entries = item.split("=", 1)
            if len(entries) == 1:
                entries = ["deadline"] + entries

            key = entries[0] 
            value = entries[1]

            if key == "start": 
                parsed_timestamp, _ = self._parse_time(value)
                label[key] = parsed_timestamp
            elif key == "deadline":
                parsed_timestamp, _ = self._parse_time(value, label.get("start", None))
                assert parsed_timestamp is not None, f"parsing deadline error! label = {label}, item = {item}"
                label[key] = parsed_timestamp
            elif key == "recur":
                # recurrence. 
                assert "start" in label, f"label['start'] has to be valid when parsing deadline. label = {label}, item = {item}"
                parsed_timestamp, time_type = self._parse_time(value, label["start"])
                assert time_type == TimestampType.FROM_RELATIVE
                label[key] = parsed_timestamp - label["start"]
                # repeat the record until maximum. 
            elif key == "ctrl":
                label[key] = value.split(",")
            elif key == "who":
                label[key] = value.split(",") 
            elif key in direct_keys:
                label[key] = value
            else:
                raise RuntimeError(f"{key} cannot be parsed! value = {value}, item = {item}")

        if "who" not in label:
            label["who"] = [gDefaultUser]

        return label

    def process_todo(self, filename):
        processed = []

        for line_number, line in enumerate(open(filename, "r")):
            last = 0
            all_labels = []
            content = ""
            omit = False
            for m in self.matcher.finditer(line):
                # TODO: Visualize the structure of the tasks in the future.
                if m.group(1) in ["DONE", "DONE_NOTE", "CANCEL", "NOTE", "SCOPE"]:
                    omit = True
                    break
                elif m.group(1) in ["TODO", "DELAY"]:
                    all_labels.append(self.parse_labels(m.group(2)))
                elif m.group(1) in ["END"]:
                    omit = True
                    break 

                # Skip all special matches and capture the content. 
                content += line[last:m.start(0)]
                last = m.end(0)
            content += line[last:]
                
            if omit or len(all_labels) == 0:
                continue

            # Find tag that is the most recent (to deal with delay.) 
            all_labels = sorted(all_labels, key=lambda x: x.get("start", 0)) 
                    
            # find all hashtags in content
            hashtags = self.hashtag_matcher.findall(content)
            if len(hashtags) == 0: 
                hashtags.append(gDefaultTag)
            processed.append(dict(labels=all_labels[-1], line_number=line_number+1, content=content, hashtags=hashtags))

        return processed
        # processed = sorted(processed, key=lambda x: x["tags"]["deadline"])
        # Convert processed back to todo list


class RecordGen:
    def __init__(self, args):
        self.args = args
        self.time_format = "%Y/%m/%d %H:%M"

    def get_stats(self, processed):
        all_hashtags = set()
        all_people = set()
        for item in processed:
            all_people = all_people.union(item["labels"]["who"])
            all_hashtags = all_hashtags.union(item["hashtags"])

        all_hashtags.add(gDefaultTag)
        all_hashtags = sorted(all_hashtags) 
        all_people = sorted(all_people) 

        return dict(all_people=all_people, all_hashtags=all_hashtags, default_user=gDefaultUser)


    def convert_record(self, processed):
        entries = []
        for item in processed:
            labels = item["labels"]
            hashtags = item["hashtags"]

            assert len(hashtags) > 0, f"item['hashtags'] should have at least one entry"
            first_hashtag = hashtags[0]

            entry = {
                "eventName": item["content"], 
                "calendar": first_hashtag,
                "hashtags": hashtags, 
                "line_number": item["line_number"],
                "who": labels["who"],
                "ctrl": []
            }

            if "ctrl" in labels:
                entry["ctrl"] = labels["ctrl"]

            if "deadline" in labels:
                deadline = labels["deadline"]
                entry["date"] = deadline.strftime(self.time_format)
                entries.append(entry)
            elif "recur" in labels:
                # Then we generate a lot of entries given the recurrence setup. 
                now = datetime.now()
                t = labels["start"]
                t_start = max(t, now - timedelta(days=self.args.recur_past_days))
                t_end = now + timedelta(days=self.args.recur_future_days)
                while t < t_end: 
                    if t >= t_start:
                        entry["date"] = t.strftime(self.time_format)
                        entries.append(deepcopy(entry))
                    t += labels["recur"]
            else:
                raise RuntimeError(f"Cannot convert to record! item = {item}")

        # Post processing. 
        records = defaultdict(list)
        records_by_hashtag = defaultdict(list)

        for entry in entries:
            for who in entry["who"]:
                records[who].append(entry)
            for hashtag in entry["hashtags"]:
                records_by_hashtag[hashtag].append(entry)

        # Sorting entries.
        for who in records.keys():
            records[who] = sorted(records[who], key=lambda x: x["date"])

        for hashtag in records_by_hashtag.keys():
            records_by_hashtag[hashtag] = sorted(records_by_hashtag[hashtag], key=lambda x: x["date"])

        return records, records_by_hashtag

def run_ftp(cmd):
    # Upload to your favorite http site.
    print(f"Fake upload to your favorite site: command: {cmd}")
    
argparser = argparse.ArgumentParser()
argparser.add_argument('todo_name', type=str, help="Your todo md name")
argparser.add_argument('--update', type=str, choices=["local", "full", "data"], default="data")
argparser.add_argument('--recur_future_days', type=int, default=30)
argparser.add_argument('--recur_past_days', type=int, default=1)

args = argparser.parse_args()

label_parser = LabelParser()
record_gen = RecordGen(args)

processed = label_parser.process_todo(args.todo_name)
gVariables = record_gen.get_stats(processed)
records, records_by_hashtag = record_gen.convert_record(processed)

with open("data.js", "w") as f:
    f.write(f"var data = {json.dumps(records, sort_keys=True, indent=4)};\n\n")
    f.write(f"var data_by_hashtag = {json.dumps(records_by_hashtag, sort_keys=True, indent=4)};\n\n")
    f.write(f"var globalVariables = {json.dumps(gVariables, sort_keys=True, indent=4)};")

if args.update == "full":
    files_to_upload = [f for f in os.listdir("./") if os.path.splitext(f)[1] in (".css", ".js", ".html", ".php")] 
elif args.update == "data":
    files_to_upload = ["data.js"]
else:
    files_to_upload = []

page_folder = "plan_ui"

if len(files_to_upload) > 0:
    cmd = f"cd public_html/{page_folder};" + ";".join([f"put {page_folder}/{f}" for f in files_to_upload]) + ";bye;"
    # Upload to your favorite place. 
    run_ftp(cmd)

