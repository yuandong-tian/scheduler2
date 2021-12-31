# A simple UI and backend for scheduling tasks

It is a combination tools of vscode plus python. 

In your VSCode setting, add the snippets as shown in `.vscode/snippet.code-snippets`:

Then you can write your markdown file as `example.md` with shortcut like `!t[tab]`. It will expand to `!TODO[start=05:44 2021/12/31;deadline=]`, automatically recording the current timestamp. You can add content after the closing bracket and the deadline. which can be absolute timestamp like `Nov. 23` or relative like `1d`, `1w` or `eonw` (end of next week).

Finally you can run the following script to create a webpage to review.  
```
python run_plan.py upload
``` 
It will create `data.js`. View your calender by opening `run.html`. The UI is borrowed from [here](https://codepen.io/peanav/pen/ulkof).

![Example UI](ui.png) 

If you want to deploy it to the http server that support php, replace `run_ftp` function with the uploading code snippets in `run_plan.py`. Also use `run.php` instead. It allows adding notes on the webpage and save it on the server side.  

# License 
MIT