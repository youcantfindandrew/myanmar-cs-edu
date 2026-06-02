============================================================
  CODE MYANMAR — Teacher Setup Guide
  Offline CS Education Platform
============================================================

QUICK START (Windows)
---------------------
1. Plug in the USB drive.
2. Open the "myanmar-cs-edu" folder.
3. Double-click "START.bat".
4. Chrome will open automatically to http://localhost:8080
5. Students can now use the app.

QUICK START (Mac / Linux)
--------------------------
1. Open a Terminal in the "myanmar-cs-edu" folder.
2. Run:  bash start.sh
3. Open Chrome and go to http://localhost:8080

MANUAL START (any computer)
----------------------------
1. Open a Command Prompt or Terminal.
2. Navigate to the myanmar-cs-edu folder.
3. Run:  python3 -m http.server 8080
4. Open Chrome and go to http://localhost:8080

DOES IT NEED THE INTERNET?
---------------------------
No. Once started, the app works completely offline.
No data is sent anywhere. Ever.

COLLECTING STUDENT PROGRESS
-----------------------------
1. Each student opens "My Progress" from the app menu.
2. Click "Export CSV".
3. A file called "progress-export-[date].csv" downloads.
4. Collect these files from each computer (copy to USB or WhatsApp).
5. Send them to the teacher for analysis.

THE AI TUTOR
------------
The AI tutor (Phi-3 mini) needs a one-time internet download (~2 GB).
- If the classroom has Wi-Fi, students click "Load Tutor" in the tutor panel.
- If not, the tutor panel shows helpful hint cards instead — lessons work fine.
- Pre-loading: connect to internet at home, load the tutor once, then it works offline.

TROUBLESHOOTING
---------------
"python3 not found":
  -> Try "python" instead of "python3"
  -> Install Python from python.org (free)

"Port 8080 already in use":
  -> Try: python3 -m http.server 9090
  -> Open http://localhost:9090 instead

"Service Worker" warning in browser:
  -> This is normal on the first load. Reload the page once.

App not loading:
  -> Make sure you are in Chrome (not Edge or Firefox for best compatibility)
  -> Make sure the server is running (you should see the terminal window)

============================================================
  Questions? Contact the developer.
  Built with care for students in Myanmar — June 2026
============================================================
