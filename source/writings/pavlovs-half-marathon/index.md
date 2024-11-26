# Pavlov's Half Marathon: Training Myself to Run More with Classical Conditioning

### TLDR

I bought an IOT dog food dispenser, filled it with M&Ms, and made a script checks the Strava API to see if I ran a sufficient distance. If I did, I got a reward like the good boy I was. This ended up being far and away the most effective running program I have ever implemented for myself. I now run long distances regularly, recently completed a half marathon (13.1 miles), and don't even use the M&M dispenser any more. Kind of like how your dog still sits even though you don't give it a treat for doing so anymore!

PUT VIDEO OF DOG FEEDER HERE - SHOULD BE IN IMOVIE

### Why

Recently, I have accepted that I have become an adult. My adulthood litmus test has always been the following:
> If you know what date it is every day, you are an adult.

Well, turns out this is wrong. I now know that what being an adult _really_ means is that most of your time is taken up by an ever-growing list of compulsory maintenance tasks that constitute the meager amount of contol you exert over your own life. And I still don't even know what the date is! Turns out that was merely my justification for being a terrible planner and meeting attender - ✨child at heart✨!

Part of understanding that I am now an adult meant readjusting what it means to exercise. I love going to the gym and spending a lot of time there, but I found myself doing it less and less, mostly because big blocks of time stopped presenting themselves to me. I accepted that I must become like all the other successful looking men I see in Griffith Park: somehow awake and alert before 9 am, their brow humid and furrowed above their blue reflective wraparound sunglasses as their powerful, egg-smooth legs effortlessly power them forward for miles, as if they are instead pulled by some invisible wire attached to their incredibly sharp, pert nipples piercing through their quarter zips. I had to become a runner.

I have a love-hate relationship with running. I used to be a fat kid, and I changed that the summer before I went to college by eating egg whites for breakfast every morning, and then running along the streetcar track in New Orleans's balmy 100-degree-100%-humidity days at noon. It was the most successful weight loss regimine I ever had, and I'm happy to say I've never needed another one like it. That said, it did not instill a fondness of running in me. I still can't listen to my 2014 running playlist without feeling mildly heat struck.

<iframe width="560" height="315" src="https://www.youtube.com/embed/4wIGITl8hC4?si=0JzitkT5rAqJLhk0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

<p style="font:10px">This is the sound of me never wearing cargo shorts again.</p>

I knew I had to do something different this time. Running was no longer a means to and end, I needed it to be a sustainable part of my life. Thankfully, I knew just the solution for how to acclimate someone or something to a routine task they don't _really_ want to do. 

See, I used to work as a Zoo, and Zoo keepers and vets have to get all sorts of animals of varying intelligence (Giraffes are like a house for sale - the lights are on but no one's home) to move certain places and do certain things, like stay on a scale to get weighed. What was the answer? Target training!

You can get all sorts of animals to do basic things like touch their nose to a target (usually a stick with a bright colored bulb at the end of it) if they know they will get food after doing it. This is due to the proven principles of classical conditioning, whereby you can get an animal to associate neutral stimuli (a wand with a yellow bulb at the end) with a desired response (touch nose to bulb) through rewarding them with positive reinforcement (food) every time they do the desired response.

Well, what am I but another food-motivated, dumb animal? It was time to associate running long distances with treats and get myself conditioned!

### How 

#### Need a Dispenser Here!

I knew I would need to get a dispenser that I could easily interoperate with, so I sought out to find the shittiest, most cheaply made looking IOT dog food dispenser on Amazon. My rationale was that it would have the worst security around whatever protocol it used to trigger the feeding, so I could easily replay whatver data was being sent to it when I wanted to. I landed on [this one](https://www.amazon.com/dp/B0CQL2KH7R?ref=ppx_yo2ov_dt_b_fed_asin_title&th=1) because I could see the app in the photo and boy did it look like the right vibe:

![app](app.png)

Turns out, I didn't have to do any reverse engineering or MitM traffic at all! This dog feeder happened to be part of the [Smart Life](https://ismartlife.me/) ecosystem (I don't know if that is the real website). Smart Life is an offshoot of [Tuya](https://www.tuya.com/), and smart home product company with a fair amount of developer support! Setting up some form of interoperability with it ended up being super easy. Thanks to the hard work of the developers behind [tinytuya](https://github.com/jasonacox/tinytuya)

#### tinytuya 

[tinytuya](https://github.com/jasonacox/tinytuya) is a Python module designed to allow programtic control of Tuya devices via Python. The UX of this Python module is incredible. There is a mildly convoluted setup process you need to go through to get you device's "secret key" to allow for the use of tinytuya, but the documentation is verbose and easy to follow, and the module even comes with both a [setup wizard](https://github.com/jasonacox/tinytuya?tab=readme-ov-file#setup-wizard---getting-local-keys) that will scan your local net to find any Tuya devices. Once everything was set up, I could dispense food at will using the following script:

```python
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

Note that this goes through their "cloud" service, which means you have to have this device connected to the internet which I know skeeves some folks out. If you wanted to have this thing completely isolated though, you could have a no-internet subnet with this device on it so long as the device you are going to run the script on has line-of-sight. The cool thing about tinytuya is that they have also implemented a local-only protocol, so you can send commands just within your LAN. This is what I ended up using for my final application, but I didn't take any precaution with walling off the dog feeder. If it port scanned my house at some point so be it. 

#### Strava

The Strava API is also quite friendly, 









