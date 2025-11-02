# Hacking MTG: Arena to Never Lose... Again


### TLDR
Client-side validation strikes again, allowing infinite losses in the official tournaments hosted on MTG Arena. Without losses to deter progress, even a terrible player like me can trophy with a ~50% win rate.

![wins](wins.png)

Note the 6-out-of-2 allotted losses.

### How it works

I'll make this one brief. If you want to learn more about how I analyze the logic of the game and make mods for it, you can check out my previous two posts about cheats I've made below, where I go into more detail about the process:

[I Hacked Magic the Gathering: Arena for a 100% Winrate](I-Hacked-Magic-the-Gathering/)

[Heisting 20 Million Dollars' Worth of Magic: The Gathering Cards in a Single Request](Heisting-20-Million-in-Magic-Cards/)

I also have a tutorial about how to analyze and mod Unity games if you're looking for step-by-step instructions:

[Unity Hacking 101: Hacking with Reflection](Unity-Hacking-101-Hacking-with-Reflection/)

Anyway, on to the bug. Looking at the logic for how the events work in MTGA, there is a big switch statement with various cases depending on the state of player within the event (hit the limit of wins, hit the limit of losses, or still playing games). It looks like this:

```csharp
public void MainButton_OnPlayButtonClicked()
    {
        switch (this.EventContext.PlayerEvent.CourseData.CurrentModule)
        {
        case PlayerEventModule.Draft:
        ...<snip>...
        case PlayerEventModule.WinLossGate:
        case PlayerEventModule.WinNoGate:
            if (EventHelper.PreconWithInvalidDeck(this.EventContext.PlayerEvent))
            {
                this.SelectDeckButtonClicked();
                return;
            }
            if (this._sharedClasses.ChallengeController.GetAllChallenges().Exists((KeyValuePair<string, PVPChallengeData> pair) => pair.Value.Direction == ChallengeDirection.Outgoing))
            {
                this._sharedClasses.SocialManager.ShowEnteringQueueWithOutgoingChallengeMessage(delegate
                {
                    this.PlayMatch();
                });
                return;
            }
            this.PlayMatch();
            return;
        case PlayerEventModule.ClaimPrize:
            PAPA.StartGlobalCoroutine(this.ClaimPrize(), false);
            return;
```

As you can see from the snippet, the state is checked locally to see if you can queue for more games or to cash out your prize. If you hit the max number of losses, the client gates you from queueing again, and your only option is to cash out... Unless you make a mod that goes in and changes back the local state to say that you should be able to queue for more games.

```csharp
var controller = FindObjectOfType<EventPageContentController>();
if (controller == null)
{
    logger.LogDebugForRelease("No EventPageContentController found!");
    return;
}

// 2. Get the private field _currentEventPage
var field = typeof(EventPageContentController)
    .GetField("_currentEventPage", BindingFlags.NonPublic | BindingFlags.Instance);

if (field == null)
{
    logger.LogDebugForRelease("_currentEventPage not found on EventPageContentController");
    return;
}

// 3. Retrieve its value (as object)
object currentEventPage = field.GetValue(controller);

if (currentEventPage == null)
{
    logger.LogDebugForRelease("_currentEventPage is null");
    return;
}

// 4. Get its type dynamically
Type eventPageType = currentEventPage.GetType();

// 5. Get the ComponentManager field *inside* the struct/class
var componentManagerField = eventPageType.GetField("ComponentManager",
    BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);

if (componentManagerField == null)
{
    logger.LogDebugForRelease("ComponentManager field not found on EventPage");
    return;
}

// 6. Finally, get its value
EventComponentManager componentManager = (EventComponentManager)componentManagerField.GetValue(currentEventPage);

logger.LogDebugForRelease($"Got ComponentManager: {componentManager}");

componentManager.EventContext.PlayerEvent.CourseData.CurrentModule = PlayerEventModule.WinNoGate;
```

This snippet just uses reflection to go find that field in the client and always set it back to be able to queue for matches. 

Seems like the backed only keeps track of wins, so you can claim your prize after grinding up to seven wins. In my case that took 6 losses, but admittedly I kept some pretty bad starting hands knowing that I could just keep playing!
