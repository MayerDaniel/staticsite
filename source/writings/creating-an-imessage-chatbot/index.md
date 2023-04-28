# Creating an iMessage Chatbot
During my internship with [CrowdStrike](https://crowdstrike.com) last summer, I was introduced to [Hubot](https://hubot.github.com/). Hubot is fun, in on all of the jokes, and exceedingly helpful. Between the automation of menial tasks and joke/novelty functions, our office chatbot was a mainstay in most threads of import.

Seeing an opportutnity for a *lot* of novelty and a little automation, I desperately wanted my own personal chatbot - but I did not belong to any personal slacks or hipchats to put one in. The only messaging service I used on a regular basis was texting, so I set about constructing a framework for reading and writing iMessages.

### Reading Messages

A chatbot must be able to listen for incoming messages process them. Since apple [does not allow iOS apps to access messages stored on an iPhone](https://stackoverflow.com/questions/28399777/read-sms-using-swift), the easiest way to field messages was to read the synced messages stored on my computer.

If you have iMessages synced to your Mac, all of the messages are stored in a SQLite database located at `~/Library/Messages/chat.db`

There is some work that has already been done with regards to reverse engineering the database structure and reading messages. The most helpful resource I found was [pymessage-lite](https://github.com/mattrajca/pymessage-lite), which laid out the database structure*:

``` bash
_SqliteDatabaseProperties  deleted_messages         
attachment                 handle                   
chat                       message                  
chat_handle_join           message_attachment_join  
chat_message_join
```

The contents of these tables should be fairly self-explanatory.

- `attachment` keeps track of any attachments (files, images, audio clips) sent or received, including paths to where they are stored locally as well as their file format.
- `handle` keeps track of all known recipients (people with whom you previously exchanged iMessages).
- `chat` keeps track of your conversation threads.
- `message` keeps track of all messages along with their text contents, date, and the ID of the recipient.

\*Credit to [Matt Rajca](https://github.com/mattrajca)

To read messages and respond to them, the pertinent information is the **contents** of the message, stored in `message`, and which **conversation** it came from, which is stored in `chat`. The two are linked by `chat_handle_join`.

I use [watchdog](https://pythonhosted.org/watchdog/) to monitor the database for file changes (new messages) and the `sqlite3` python package to get the contents the new messages. Here is an excerpt from my iMessage processing library:

``` python
LAST_READ = -1

# Fetches all messages exchanged with a given recipient.
def get_last_message():
	global LAST_READ                # highest index message that has been read

	connection = _new_connection()  # sqlite3 connection
	c = connection.cursor()         # sqlite3 cursor
	text = ''
	row_id = ''
	date = ''
	if LAST_READ == -1:             # if chatbot just booted, set to current max
		c.execute("SELECT * FROM message WHERE ROWID = (SELECT MAX(ROWID) FROM message)")
	else:                           # otherwise get all new messages
		c.execute("SELECT * FROM message WHERE ROWID > " + str(LAST_READ))

	messages = []
	for row in c:
		row_id = row[0]
		text = row[2]
		if text is None:
			continue                # ignore empty messages like images

		date = datetime.datetime.now()
		encoded_text = text.encode('ascii', 'ignore')
		message = Message(encoded_text, date) # Message datastructure to keep time and message
		guid = id_to_guid(row_id)   # id_to_guid(row_id) is a similar method using
		LAST_READ = row_id          # `chat_message_join` to retrieve the number from `chat
		messages.append([message, guid])

	return(messages)


	connection.close()
```
The full file can be found [**HERE**](https://github.com/MayerDaniel/edgar/blob/master/imessage.py)


Once all of the messages are in a neat array, a chatbot can use any number of language processing tools to consume commands and run the appropriate python code. *But*, how does it respond to those commands in iMessage?

### Sending Messages
There is no iMessage api to send messages through python, nor is there one for any language except for applescript. Thankfully, there is a commandline tool, [osacscript](https://ss64.com/osx/osascript.html), which allows users to write and run arbitrary applescript commands. I used the `os` package in python to pipe the command into bash to run it. I based my command off of [this stackoverflow question](https://stackoverflow.com/questions/44852939/send-imessage-to-group-chat), since it was the only command I could find which allowed sending messages to named groups.

Implementation:
``` python
#takes a message to send(string) and an imessage chat id to send it to(guid)
def send_message(self, string, guid):
        string = string.replace("'", "")        #remove quotes in message due to
        string = string.replace('"', '')        #inability to escape them in command.    

        body = """
            osascript -e 'tell application "Messages"
              set myid to "%s"
              set mymessage to "%s"
              set theBuddy to a reference to text chat id myid
              send mymessage to theBuddy
            end tell' """ % (guid, string)
        print(body)
        os.system(body)
```

And there you have it! Between reading and sending iMessages, a chatbot can now be created!

See my full implementation [**HERE**](https://github.com/MayerDaniel/edgar)
