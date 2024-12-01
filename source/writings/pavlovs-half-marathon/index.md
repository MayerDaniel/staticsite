<script src="https://d3js.org/d3.v7.min.js"></script>
# Pavlov's Half Marathon: Training Myself to Run More with Classical Conditioning

## TLDR

I bought an IOT dog food dispenser, filled it with M&Ms, and made a script checks the Strava API to see if I ran a sufficient distance. If I did, I got a reward like the good boy I was. 

This ended up being far and away the most effective running program I have ever implemented for myself. I now run long distances regularly, recently completed a half marathon (13.1 miles), and don't even use the M&M dispenser anymore. Kind of like how your dog still sits even though you don't give him a treat for doing so anymore!

<video width="100%" controls>
  <source src="./explainer.mp4#t=0.001" type="video/mp4">
  Your browser does not support the video tag.
</video>

## Why

Recently, I have accepted that I have become an adult. My adulthood litmus test has always been the following:
> *If you know what date it is every day, you are an adult.*

Well, turns out this is wrong. I now know that what being an adult _really_ means is that most of your time is taken up by an ever-growing list of compulsory maintenance tasks that constitute the meager amount of contol you exert over your own life. And I _still_ don't even know what the date is! Turns out that was merely my justification for being a terrible planner and meeting attender - \*child at heart\*!

Part of understanding that I am now an adult meant readjusting what it means to exercise. I love going to the gym and spending a long time there, but I found myself doing it less and less, mostly because big blocks of time stopped presenting themselves to me. Running is like a goldfish, though. It will grow to the size of its bowl, plus it was always right outside my doorstep. So it was time to become a runner.

The problem is that I have a love-hate relationship with running. I used to be a fat kid, and I changed that the summer before going to college by running along the streetcar track every day in New Orleans's balmy 100-degree, 100% humidity days at noon. It was the most successful weight loss regimine I ever had, and I'm happy to say I've never needed another one like it. That said, it did not instill a fondness for running in me. I still can't listen to my 2014 running playlist without feeling mildly heat struck.

<iframe width="560" height="315" src="https://www.youtube.com/embed/IGgBWghFgZQ" title="YouTube video player" frameborder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="origin-when-cross-origin" allowfullscreen style="display: block; margin: 0 auto;"></iframe>

<p style="font-size: .8em;">This is the sound of me never wearing cargo shorts again.</p>

I knew I had to do something different this time. Running was no longer a means to and end, I needed it to be a sustainable part of my life. Thankfully, I knew just the solution for how to acclimate myself. 

I used to work as a Zoo. Zoo keepers and vets have to get animals of varying intelligence (Giraffes are like a house for sale - the lights are on but nobody's home) to move certain places and do certain things, like stay on a scale to get weighed. They did this by target training the animals.

<iframe width="560" height="315" src="https://www.youtube.com/embed/ylYwif3it1Y" title="YouTube video player" frameborder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="origin-when-cross-origin" allowfullscreen style="display: block; margin: 0 auto;"></iframe>

You can get animals to do basic things like touch their nose to a target if they know they will get food after doing it. This is due to the proven principles of classical conditioning, whereby you can get an animal to associate neutral stimuli (the wand) with a desired response (touch nose to wand) by rewarding them with positive reinforcement (food) every time they do the desired response. 

Before long, as soon as you show them the stick, they will touch their nose to it due to the positive association. Well, what am I but another food-motivated, dumb animal? It was time to associate running long distances with treats and get myself conditioned!

## How 

### The feeder

I knew I had to get a food dispenser that I could control with Python, so I sought out to find the shittiest, most cheaply made looking IOT dog food dispenser on Amazon. My rationale was that it would have the worst security around whatever protocol it used to trigger the feeding, so I could easily capture and replay the feed command. I landed on [this one](https://www.amazon.com/dp/B0CQL2KH7R?ref=ppx_yo2ov_dt_b_fed_asin_title&th=1) because I could see the app in the photo and boy did it look like the right vibe:

![app](app.png)

Turns out, I didn't have to do any reverse engineering or MitM traffic at all! This dog feeder happened to be part of the "Smart Life" ecosystem. Smart Life is an offshoot of [Tuya](https://www.tuya.com/), a smart home product company with a fair amount of developer support! Setting up programmatic access with it was super easy, mostly thanks to the hard work of the maintainers of [tinytuya](https://github.com/jasonacox/tinytuya).

### tinytuya 

[tinytuya](https://github.com/jasonacox/tinytuya) is a Python module designed to allow programtic control of Tuya devices via Python. The UX of this Python module is incredible. There is a mildly convoluted setup process you need to go through to get you device's "secret key" to allow for the use of tinytuya, but the documentation is verbose and easy to follow, and the module even comes with a [setup wizard](https://github.com/jasonacox/tinytuya?tab=readme-ov-file#setup-wizard---getting-local-keys) that will scan your local net to find any Tuya devices. Once everything was set up, I could dispense food at will using the following script:

```python
import tinytuya

# Connect to Tuya Cloud
c = tinytuya.Cloud(
        apiRegion="us", 
        apiKey="XXXXXXXXXXXXXXXXXXXXXXXX", 
        apiSecret="XXXXXXXXXXXXXXXXXXXXXXXX", 
        apiDeviceID="XXXXXXXXXXXXXXXXXXXXXXXX")

# Display list of devices
devices = c.getdevices()
print("Device List: %r" % devices)

# Select a Device ID to Test
id = "XXXXXXXXXXXXXXXXXXXXXXXX"

# Display Properties of Device
result = c.getproperties(id)
print("Properties of device:\n", result)

# Display Status of Device
result = c.getstatus(id)
print("Status of device:\n", result)

# Send Command - Dog Food!
commands = {
    "commands": [
        {"code": "manual_feed", "value": 1},
    ]
}
print("Sending command...")
result = c.sendcommand(id,commands)
print("Results\n:", result)
```

Note that this goes through their cloud service, which means you have to have this device connected to the internet which I know skeeves some folks out. If you wanted to have this thing completely isolated though, you could have a no-outbound-internet subnet with this device on it so long as the device you are going to run the script on has line-of-sight. 

You can do this because Tuya devices have a local-only protocol that tinytuya supports, so you can send commands just within your LAN. This is what I ended up using for my final application (see next section), but I also didn't take any precaution with walling off the dog feeder. If it port scanned my house at some point and shipped the data somewhere, so be it. 

### Strava

The Strava API is also quite friendly - I used [stravalib](https://github.com/stravalib/stravalib) to interface with it. One hangup with Strava is that it only allows for authentication via oauth, with tokens that only last 6 hours once minted. This means that instead of having a little script that held an API token to hit the Strava API, I had to make a minimal webserver to both redirect to the oauth page and catch the auth code after successful authentication. This ended up being pretty nice though because it meant that I could run the program from my phone! 

There was also a bit of legwork [setting up an "application" with Strava](https://medium.com/analytics-vidhya/accessing-user-data-via-the-strava-api-using-stravalib-d5bee7fdde17) to be able to hit the API.

In the end, the Python code relevant to Strava looked like this. The domain you see referenced, `food.mayer.cool` just points to a local IP I assigned to my flask server. I believe this can just be a local IP or localhost, I made an A record in namecheap so I could remember it and type it into my phone easily.

```python
import flask
from stravalib import unithelper
from stravalib.client import Client

client = Client()  
app = flask.Flask(__name__)

# Start the oauth flow
@app.route("/start")
def start():
    authorize_url = client.authorization_url(
        client_id=XXXXXX, redirect_uri="http://food.mayer.cool:8282/authorized"
    )
    return flask.redirect(authorize_url)

# Catch the oauth flow and print data about the most recent run
@app.route("/authorized")
def authorized():
    # Have the user click the authorization URL, a 'code' param will be added to the redirect_uri
    # .....
    code = flask.request.args.get("code")
    
    token_response = client.exchange_code_for_token(
        client_id=XXXXXX, client_secret="XXXXXXXXXXXXXXXXXXXXX", code=code
    )
    # Pull out auth material
    access_token = token_response["access_token"]
    refresh_token = token_response["refresh_token"]
    expires_at = token_response["expires_at"]

    # Set auth material in the client
    client.access_token = access_token
    client.refresh_token = refresh_token
    client.token_expires_at = expires_at

    # Get my data
    athlete = client.get_athlete()
    most_recent = next(client.get_activities(limit=1))

    # use unithelper to convert distance to miles
    print(f"Miles ran: {unithelper.miles(most_recent.distance)}")
```

### Final script

Gluing the two pieces together, I could set how long I needed to run (I hardcoded it and changed it as I progressed), check Strava, and dispense a treat for myself. I used pickled data to keep track of when I last ran to ensure that I only got one set of M&Ms per run.

My complete script ended up looking like this:

```python
import datetime
import flask
import json
import pickle
import requests
import tinytuya
from stravalib import unithelper
from stravalib.client import Client

client = Client()  
app = flask.Flask(__name__)

@app.route("/authorized")
def authorized():
    # Have the user click the authorization URL, a 'code' param will be added to the redirect_uri
    # .....
    code = flask.request.args.get("code")

    token_response = client.exchange_code_for_token(
        client_id=XXXXX, client_secret="XXXXXXXXXXXXXXXXXX", code=code
    )
    # Pull out auth material
    access_token = token_response["access_token"]
    refresh_token = token_response["refresh_token"]
    expires_at = token_response["expires_at"]

    # Set auth material in the client
    client.access_token = access_token
    client.refresh_token = refresh_token
    client.token_expires_at = expires_at

    # Get my data
    athlete = client.get_athlete()
    most_recent = next(client.get_activities(limit=1))

    # Check distance
    distance = 4
    if unithelper.miles(most_recent.distance).magnitude < distance:
        return f"You need to run at least {distance} miles to deserve a treat!"

    # Check pickle file to see if we've already fed for this run
    try:
        with open('last_run_time.pkl', 'rb') as f:
            last_run_time = pickle.load(f)
    except FileNotFoundError:
        last_run_time = datetime.datetime(1900, 7, 28, 19, 7, 56, tzinfo=datetime.timezone.utc)

    if most_recent.start_date <= last_run_time:
        return "You've already been fed for this run!"

    # connect to the device locally
    d = tinytuya.Device('XXXXXXXXXXX', '192.168.1.XXX', 'XXXXXXXXXXXX', version=3.4)
    data = d.status()  

    # Show status and state of first controlled switch on device
    print('Dictionary %r' % data)

    # Locally we can just set the oid 3 to a value of 1, which will dispence one round of M&Ms
    d.set_value(3,1)

    # Save current time as pickle file
    with open('last_run_time.pkl', 'wb') as f:
        pickle.dump(most_recent.start_date, f)


    return "Authorization successful"

@app.route("/start")
def start():
    authorize_url = client.authorization_url(
        client_id=119442, redirect_uri="http://food.mayer.cool:8282/authorized"
    )
    return flask.redirect(authorize_url)


if __name__ == "__main__":
    print("Starting server...")
    print("Go to http://food.mayer.cool:8282/start to begin the authorization process")
    app.run(host="0.0.0.0", port=8282)

```

And there you have it! Your very own treat dispenser. This same flow could be used to track and reward progress on all sorts of stuff, not just run distance. Budgeting, git commits, you name it. Anything with a digital form of tracking and can give immediate feedback for can be "trained" in the same way!

## Efficacy

Ok, I know what you are thinking: "This is so stupid, why didn't Dan just open up the top of the feeder, or go buy M&Ms when he wanted them? Isn't human free will more powerful than being trained like a dog?" 

And I think that obviously this will depend on the person, but for me personally, the answer is no. Bare with me as I get a little bit philosphical. Here are my thoughts on this after living with it for a few months:

### We are creatures of habit 

This one is pretty basic and I can only speak for myself, but I mostly do the same stuff every day. "Free will" doesn't factor into quotidian life much, the "decisions" you make are much more subtle and implicit - you don't think about opening up your phone when you are bored, you just do. That was my goal with running - I wanted it to become something I just do.

 I don't usually keep M&Ms in the house and am not in the habit of eating them, so I didn't feel a deep urge to "cheat". I instead was building a completely new habit where I ate M&Ms after achieving a goal. The wires never got crossed in my brain where the M&Ms became the goal, they became a small positive association, but that was it. Having a small positive association was all the difference though. See point 2:

### My brain's cost-benefit analysis is fried

The world is designed to lure us into forming bad habits. Food companies, entertainment companies, brokerages, and just about everything else at this point has been hyper-optimized to form positive associations in our animal brain with consumption. This is a tough system to live in, because our aspirations are usually more nebulous than "feel good", which is what the products promise us. 

Our aspirations do not easily produce positive associations that immediately form. In the case of running, when I tell myself I want to run, it is because I want to stay healthy, minimize my chances of chronic pain, and have a more sustainable, balanced life. None of those things give me immediate gratification the same way I would have if I sat down and played a very stimulating video game instead of running. 

Does that mean that I actually want to play an hour of Magic: The Gathering Arena instead of running? No. It just means that the designers of free-to-play games now have 30+ years of research backing up how to make their game feel as good as possible to play, and how to deliver immediate positive feedback when I play it to keep me coming back. 

Running is a much simpler activity, and no one is engineering it to make me feel like I am having a good time when I engage with it - in fact I usually actively feel neutral to bad. So when my brain is making one of those subtle, implicit decisions it doesn't see a lot of benefit from going running. Running is going to be hard, and it is unclear what I will really get out of it. Arena is easy to access, and I will get a bunch of dopamine hits while playing! Multiply this dilemma by every decision we make day-to-day, and you see why so many folks have developed bad habits. It is an unfair fight. Our aspirations hardly stand a chance.

Attaching a small, mostly symbolic reward to achieving my goals helped me level the playing field. After setting up the dispenser, when my brain weighed those options, running still looked hard, but there was also a small concrete dopamine hit associated with it. Achieving my goals _is what I wanted deep down_, and it was now easier to convince my animal brain that it was in its best interest too. 

The best part is, after you have trained your dog to sit, he will still sit long after your stop feeding him treats. It appears I am no different. I have stopped using the M&M dispenser, but I am still running regularly.

### Results

Here are the runs I tracked with Strava over the course of this experiment:

<svg width="900" height="500"></svg>
  <script>
    // Raw data
    const rawData = `
    12917797936,2024-11-16 22:27:36+00:00,13.339534617831863 mile,2:08:19
12917205018,2024-11-15 01:07:39+00:00,4.205564503300724 mile,0:37:52
12888547514,2024-11-13 03:14:39+00:00,2.9260369442456056 mile,0:30:06
12872365901,2024-11-11 00:25:41+00:00,8.25255507834248 mile,1:24:03
12825498497,2024-11-05 02:39:03+00:00,3.1683717092181656 mile,0:28:24
12808158716,2024-11-02 21:27:47+00:00,2.6467305933349237 mile,0:23:41
12778283843,2024-10-27 05:06:26+00:00,6.301200986240356 mile,1:23:40
12753771654,2024-10-25 00:28:13+00:00,2.1603833611707626 mile,0:19:33
12721676829,2024-10-22 23:23:29+00:00,3.6783931838065693 mile,0:53:23
12697356240,2024-10-20 02:53:26+00:00,4.3090228068082395 mile,0:39:14
12681695853,2024-10-18 00:13:41+00:00,3.01632217847769 mile,0:26:59
12666177640,2024-10-16 01:25:48+00:00,3.01532798457011 mile,0:27:59
12658032571,2024-10-15 03:37:10+00:00,1.0409210212359818 mile,0:10:20
12583163655,2024-10-05 18:19:25+00:00,2.013677622683528 mile,0:22:50
12570066638,2024-10-04 06:02:06+00:00,3.2141046289668336 mile,0:32:56
12553479681,2024-10-02 03:27:03+00:00,3.0183105662928496 mile,0:24:32
12488588365,2024-09-24 02:06:24+00:00,3.407537481110315 mile,0:31:52
12471248988,2024-09-21 23:45:39+00:00,4.056373280044539 mile,0:35:45
12447378162,2024-09-19 03:46:37+00:00,6.04563101487314 mile,0:53:42
12438747503,2024-09-18 04:44:36+00:00,3.0350875884832575 mile,0:25:52
12429407640,2024-09-17 02:44:52+00:00,2.157462916567247 mile,0:23:02
12412081500,2024-09-15 01:00:31+00:00,2.0657485285930166 mile,0:16:57
12380716473,2024-09-11 04:21:41+00:00,3.0831195816432038 mile,0:27:14
12354457712,2024-09-08 03:13:02+00:00,3.068517358625626 mile,0:27:23
12345022251,2024-09-07 00:47:04+00:00,0.9217420265648611 mile,0:09:58
12320757784,2024-09-04 03:05:31+00:00,3.0811311938280443 mile,0:26:52
12294417779,2024-09-01 03:54:22+00:00,5.019685039370078 mile,0:45:05
12278295844,2024-08-30 04:02:26+00:00,4.772503579098067 mile,0:56:43
12260840369,2024-08-28 02:49:14+00:00,2.3776147299769343 mile,0:22:14
12251641983,2024-08-27 02:17:35+00:00,2.0172194384792808 mile,0:19:52
12234698885,2024-08-25 02:28:30+00:00,2.370282549908534 mile,0:21:04
12225911083,2024-08-24 00:36:38+00:00,2.073080708661417 mile,0:19:44
12210252764,2024-08-22 02:37:35+00:00,3.0486334804740314 mile,0:28:54
12192159257,2024-08-20 01:49:37+00:00,2.5077298576314324 mile,0:23:28
12181970873,2024-08-18 18:09:43+00:00,2.434843016781993 mile,0:23:11
12165045712,2024-08-16 19:20:05+00:00,2.385816829714467 mile,0:23:06
12149964355,2024-08-15 00:29:59+00:00,2.5309070031018845 mile,0:21:28
12142022256,2024-08-14 02:14:22+00:00,2.424963214825419 mile,0:21:34
12132336316,2024-08-12 23:47:37+00:00,2.1312410522548317 mile,0:19:13
12113801582,2024-08-10 18:07:41+00:00,2.027347788912749 mile,0:18:41
12106082804,2024-08-09 20:48:44+00:00,2.2415965759961822 mile,0:20:50`;

    // Parse the data
    const data = rawData.trim().split('\n').map(line => {
      const [id, timestamp, distance, duration] = line.split(',');
      return {
        time: new Date(timestamp),
        distance: parseFloat(distance.split(' ')[0])
      };
    });

    // Set up SVG dimensions
    const margin = { top: 20, right: 30, bottom: 50, left: 50 };
    const width = 900 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;

    const svg = d3.select('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Define scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => d.time))
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.distance)])
      .nice()
      .range([height, 0]);

    // Add axes with formatting
    const xAxis = d3.axisBottom(xScale)
      .ticks(d3.timeWeek.every(1)) // Tick every 2 days
      .tickFormat(d3.timeFormat("%m-%d")); // Format as MM-DD

    const yAxis = d3.axisLeft(yScale);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis);

    svg.append('g')
      .call(yAxis);

    // Draw line
    const line = d3.line()
      .x(d => xScale(d.time))
      .y(d => yScale(d.distance));

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'steelblue')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Plot data points
    svg.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.time))
      .attr('cy', d => yScale(d.distance))
      .attr('r', 5)
      .attr('fill', 'steelblue');

    // Add labels
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height + margin.bottom - 10)
      .attr('text-anchor', 'middle')
      .text('Time (MM-DD)');

    svg.append('text')
      .attr('x', -height / 2)
      .attr('y', -margin.left + 15)
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .text('Distance (miles)');
  </script>

I don't think that I ever set the M&M payout distance to be more that 4 miles, which definitely shows in the data. There were plenty of days that I didn't feel great, and pushed to get to the distance limit and stopped - some may see this is bad but for me it was exactly what I needed! And as I did that more, It became apparent that once you reach a certain level of physical conditioning, running longer distances is more gated by joints, feet, and time than endurance. 

More than anything else, I was gated by time on my long runs, which if you recall, is why I started this whole thing in the first place. It is difficult to find a free 3 hours to warm up, run, and then cool down, stretch, and so on. So you can see I mostly ran at the 3-4 mile range with a few longer runs, and then on the weekends started ramping up distance. My half marathon run did really tear up my feet though, and I have been taking it relatively easy since then, back down in the 3-4 range. 

## What's next

Since this whole quest is more to keep me healthy and in the habit than reaching any particular goal, I don't foresee myself doing super long runs in the future, instead keeping in the 6-8 range for long runs and trying to work on speed. I average around a 9 minute mile right now and would like to get that lower. I also now feel pretty habituated, which means it is time to classically condition myself to do something else. I am thinking that working on side projects more frequently, or keeping with learning a new skill will be great applications. 

I hope this makes you think more about how you could incentivize yourself to achieve your goals, and combat all the forces at work trying to steal away your time and attention. 

Speaking of which, I have no advertising or analytics on my website (besides whatever the embeds bring in for themselves), so it would mean a lot if you [signed my guestbook](https://users3.smartgb.com/g/g.php?a=s&i=g36-36443-57) if you enjoyed the reading! Thanks for stopping by.