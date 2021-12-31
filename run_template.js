!function() {
    function add2dropdown(name, items, onchange = null) {
      var dropDown = document.querySelector(name);
      items.forEach((item) => {
        var option = document.createElement("option");
        option.value = item;
        option.innerHTML = item;
        dropDown.options.add(option);
      });
      if (onchange != null) {
        dropDown.onchange = function() { 
          onchange(this.value); 
        };
      }
      return dropDown;
    }

    function hashCode(s) {
      return s.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
    }

    function removeAllChildNodes(parent) {
      while (parent.firstChild) {
          parent.removeChild(parent.firstChild);
      }
  }

    function convert2moment(data) {
      var hashtags_colors = ["blue", "darkblue", "red", "yellow", "green", "red", "orange", "magenta", "black"];
      var hashtag2color = {};
      Object.entries(data).forEach(([key, value]) => {
        Object.entries(value).forEach(([key2, value2]) => {
          value2.date = moment(value2.date, "YYYY/MM/DD HH:mm");
          if (hashtag2color[value2.calendar] == undefined) {
            hashtag2color[value2.calendar] = hashtags_colors[Object.keys(hashtag2color).length % hashtags_colors.length]; 
          } 
          value2.color = hashtag2color[value2.calendar];  
          // hashtags_colors[code % hashtags_colors.length];
          // console.log(value2.calendar + " has color " + value2.color);
          // console.log(hashtag2color);
        });
      });
    }

    var today = moment();
  
    function Calendar(selector, events, events_by_hashtag, gVars) {
      this.el = document.querySelector(selector);
      this.allEvents = events;
      this.allEventsByHashtags = events_by_hashtag;
      this.gVars = gVars;
      // Add "choose all" option.
      this.gVars["all_hashtags"].push("*");

      convert2moment(this.allEvents);
      convert2moment(this.allEventsByHashtags);

      var userMenu = add2dropdown("#userMenu", Object.keys(this.allEvents), (v) => this.setUser(v)); 
      var pastDueUserMenu = add2dropdown("#past-due-user-menu", Object.keys(this.allEvents), (v) => this.setPastDueUser(v));
      var hashTagMenu = add2dropdown("#hashtagMenu", this.gVars["all_hashtags"], (v) => this.setHashTag(v)); 

      this.currUser = this.gVars["default_user"];
      userMenu.value = this.currUser;

      this.currPastDueUser = "*";
      pastDueUserMenu.value = this.currPastDueUser;

      this.currHashTag = "*";
      hashTagMenu.value = this.currHashTag;
      this.current = moment().date(1);
      this.draw();

      var current = document.querySelector('.today');
      if(current) {
        var self = this;
        window.setTimeout(function() {
          self.openDay(current);
        }, 16);
      }
    }
  
    Calendar.prototype.draw = function() {
      //Create Header
      this.drawHeader();
  
      //Draw Month
      this.drawMonth();

      var tasks_for_hashtag = document.querySelector("#comments");
      var events = [];
      var self = this;
      if (this.currHashTag != "*") {
        var events = this.allEventsByHashtags[self.currHashTag].reduce(function(memo, ev) {
          // if(ev.date.isSame(day, 'day')) {
          memo.push(ev);
          //}
          return memo;
        }, []);
      }
      this.renderEvents(events, tasks_for_hashtag, true, true);

      var past_due_tasks = document.querySelector("#past-due");
      var memo = [];
      Object.entries(this.allEventsByHashtags).forEach(([user, value]) => {
        //if (self.currHashTag == "*" || self.currHashTag == user) {
          value.forEach(function(ev) {
            var rightPerson = self.currPastDueUser == "*" || self.currPastDueUser == ev.who;
            if(rightPerson && !ev.ctrl.includes("p") && ev.date.diff(today, "days") <= -1) {
              memo.push(ev);
            }
          });
        //}
      });
      // sorting memo according to the date. 
      memo.sort((ev1, ev2) => { return ev1.date > ev2.date ? 1 : -1; });
      this.renderEvents(memo, past_due_tasks, true, true);
      this.drawLegend();
    }
  
    Calendar.prototype.drawHeader = function() {
      var self = this;
      if(!this.header) {
        //Create the header elements
        this.header = createElement('div', 'header');
        this.header.className = 'header';
  
        this.title = createElement('h1');
  
        var right = createElement('div', 'right');
        right.addEventListener('click', function() { self.nextMonth(); });
  
        var left = createElement('div', 'left');
        left.addEventListener('click', function() { self.prevMonth(); });
  
        //Append the Elements
        this.header.appendChild(this.title); 
        this.header.appendChild(right);
        this.header.appendChild(left);
        this.el.appendChild(this.header);
      }
  
      this.title.innerHTML = this.current.format('MMMM YYYY');
    }
  
    Calendar.prototype.drawMonth = function() {
      var self = this;
      
      if(this.month) {
        this.oldMonth = this.month;
        /*
        self.oldMonth.parentNode.removeChild(self.oldMonth);
        self.el.removeChild(self.comments);
        // self.el.removeChild(self.comments2);

        self.month = createElement('div', 'month');
        self.el.appendChild(self.month);
        self.backFill();
        self.currentMonth();
        self.fowardFill();
        self.comments = document.createElement("div", "comments");
        self.el.appendChild(self.comments);
        // self.comments2 = document.createElement("div", "comments");
        // self.el.appendChild(self.comments2);
        */
        this.oldMonth.className = 'month out ' + (self.next ? 'next' : 'prev');
        this.oldMonth.addEventListener('webkitAnimationEnd', function() {
          self.oldMonth.parentNode.removeChild(self.oldMonth);
          self.el.removeChild(self.comments);
          // self.el.removeChild(self.comments2);

          self.month = createElement('div', 'month');
          self.backFill();
          self.currentMonth();
          self.fowardFill();
          self.el.appendChild(self.month);
          self.comments = document.createElement("div", "comments");
          self.el.appendChild(self.comments);
          // self.comments2 = document.createElement("div", "comments");
          // self.el.appendChild(self.comments2);

          window.setTimeout(function() {
            self.month.className = 'month in ' + (self.next ? 'next' : 'prev');
          }, 16);
        });
      } else {
          this.month = createElement('div', 'month');
          this.el.appendChild(this.month);
          this.comments = document.createElement("div", "comments");
          this.el.appendChild(this.comments);
          // this.comments2 = document.createElement("div", "comments");
          // this.el.appendChild(this.comments2);
          this.backFill();
          this.currentMonth();
          this.fowardFill();
          this.month.className = 'month new';
      }
    }
  
    Calendar.prototype.backFill = function() {
      var clone = this.current.clone();
      var dayOfWeek = clone.day();
  
      if(!dayOfWeek) { return; }
  
      clone.subtract('days', dayOfWeek+1);
  
      for(var i = dayOfWeek; i > 0 ; i--) {
        this.drawDay(clone.add('days', 1));
      }
    }
  
    Calendar.prototype.fowardFill = function() {
      var clone = this.current.clone().add('months', 1).subtract('days', 1);
      var dayOfWeek = clone.day();
  
      if(dayOfWeek === 6) { return; }
  
      for(var i = dayOfWeek; i < 6 ; i++) {
        this.drawDay(clone.add('days', 1));
      }
    }
  
    Calendar.prototype.currentMonth = function() {
      var clone = this.current.clone();
  
      while(clone.month() === this.current.month()) {
        this.drawDay(clone);
        clone.add('days', 1);
      }
    }
  
    Calendar.prototype.getWeek = function(day) {
      if(!this.week || day.day() === 0) {
        this.week = createElement('div', 'week');
        this.month.appendChild(this.week);
      }
    }
  
    Calendar.prototype.drawDay = function(day) {
      var self = this;
      this.getWeek(day);
  
      //Outer Day
      var outer = createElement('div', this.getDayClass(day));
      outer.addEventListener('click', function() {
        if(this.className !== "day other") {
          self.openDay(this);
        }
      });
  
      //Day Name
      var name = createElement('div', 'day-name', day.format('ddd'));
  
      //Day Number
      var number = createElement('div', 'day-number', day.format('DD'));
  
  
      //Events
      var events = createElement('div', 'day-events');
      this.drawEvents(day, events);
  
      outer.appendChild(name);
      outer.appendChild(number);
      outer.appendChild(events);
      this.week.appendChild(outer);
    }
  
    Calendar.prototype.drawEvents = function(day, element) {
      if(day.month() === this.current.month()) {
        var self = this;
        var todaysEvents = this.allEvents[this.currUser].reduce(function(memo, ev) {
          if(ev.date.isSame(day, 'day') && (self.currHashTag === "*" || ev.hashtags.includes(self.currHashTag))) {
            memo.push(ev);
          }
          return memo;
        }, []);
  
        todaysEvents.forEach(function(ev) {
          var evSpan = createElement('span', ev.color);
          element.appendChild(evSpan);
        });
      }
    }
  
    Calendar.prototype.getDayClass = function(day) {
      classes = ['day'];
      if(day.month() !== this.current.month()) {
        classes.push('other');
      } else if (today.isSame(day, 'day')) {
        classes.push('today');
      }
      return classes.join(' ');
    }
  
    Calendar.prototype.openDay = function(el) {
      var dayNumber = +el.querySelectorAll('.day-number')[0].innerText || +el.querySelectorAll('.day-number')[0].textContent;
      var day = this.current.clone().date(dayNumber);

      var self = this;
      var todaysEvents = this.allEvents[this.currUser].reduce(function(memo, ev) {
        if(ev.date.isSame(day, 'day') && (self.currHashTag === "*" || ev.hashtags.includes(self.currHashTag))) {
          memo.push(ev);
        }
        return memo;
      }, []);
  
      this.renderEvents(todaysEvents, this.comments); 

      if (this.lastDay != undefined) {
        this.lastDay.style.fontWeight = "normal";
      }
      el.style.fontWeight = "bold";
      this.lastDay = el;
    }
  
    Calendar.prototype.renderEvents = function(events, container, showDate = false, showWho = false) {
      //Remove any events in the current details element
      // var container = ele; 
      var currentWrapper = container.querySelector('.events');
      // var wrapper = createElement('div', 'events' + (currentWrapper ? ' new' : ''));
      var wrapper = createElement('div', 'events');

      // Sort the events accordingly. 
      events.sort((e1,e2) => {
        var p1 = e1.ctrl.includes("p");
        var p2 = e2.ctrl.includes("p");

        if (p1 && !p2) {
          return -1;
        }
        if (p2 && !p1) {
          return 1;
        }

        return e1.date < e2.date;
      });
  
      events.forEach(function(ev) {
        var div = createElement('div', 'event');
        var square = createElement('div', 'event-category ' + ev.color);

        // First deal with event name. If we see links we should wrap it with hyperlink
        var content = ev.eventName.split(" ").map((e) => {
          if (e.startsWith("arxiv")) {
            e = "http://" + e;
          }
          if (e.startsWith("http")) {
            return "<a href='" + e + "'>link</a>";
          } else {
            return e;
          }
        }).join(" ");
        // Past due.
        if(ev.date.diff(today, 'days') <= -1) {
          content = "<font color='#CCCC88'>" + content + "</font>";
        }
        content = content + "[" + ev.line_number + "]";
        if (showWho) {
          content = '[<font color="#AAAAFF">' + ev.who.toString() + "</font>]" + content;
        }
        if (showDate) {
          content = "[" + ev.date.format("ddd MM/DD") + "]" + content;
        }
        if (ev.ctrl.includes("p")) {
          var t_str = ev.date.format("HH:mm"); 
          var past = ev.date.diff(today, 'seconds') < 0;
          if (past) {
            t_str = '<font color="#CCCC88">' + t_str + "</font>"; 
          }
          content = "[" + t_str + "]" + content;
          if (past) {
            content = "<del>" + content + "</del>";
          }
        }
        var span = createElement('span', '', content);
  
        div.appendChild(square);
        div.appendChild(span);
        wrapper.appendChild(div);
      });
  
      if(!events.length) {
        var div = createElement('div', 'event empty');
        var span = createElement('span', '', 'No Events');
  
        div.appendChild(span);
        wrapper.appendChild(div);
      }
  
      if(currentWrapper) {
        currentWrapper.parentNode.removeChild(currentWrapper);
      } 
      container.appendChild(wrapper);
    }
  
    Calendar.prototype.drawLegend = function() {
      var legend = document.querySelector('#legend');
      removeAllChildNodes(legend);
      var calendars = this.allEvents[this.currUser].map(function(e) {
        return e.calendar + '|' + e.color;
      }).reduce(function(memo, e) {
        if(memo.indexOf(e) === -1) {
          memo.push(e);
        }
        return memo;
      }, []).forEach(function(e) {
        var parts = e.split('|');
        var entry = createElement('span', 'entry ' +  parts[1], parts[0]);
        legend.appendChild(entry);
      });
    }

    Calendar.prototype.setPastDueUser = function(user) {
      this.currPastDueUser = user;
      this.draw();
    }

    Calendar.prototype.setUser = function(user) {
      this.currUser = user;
      this.draw();
    }

    Calendar.prototype.setHashTag = function(hashtag) {
      this.currHashTag = hashtag;
      this.draw();
    }
  
    Calendar.prototype.nextMonth = function() {
      this.current.add('months', 1);
      this.next = true;
      this.draw();
    }
  
    Calendar.prototype.prevMonth = function() {
      this.current.subtract('months', 1);
      this.next = false;
      this.draw();
    }
  
    window.Calendar = Calendar;
  
    function createElement(tagName, className, innerText) {
      var ele = document.createElement(tagName);
      if(className) {
        ele.className = className;
      }
      if(innerText) {
        ele.innerHTML = innerText;
      }
    return ele;
    }
  }();