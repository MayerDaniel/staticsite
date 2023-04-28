# I Hacked Magic the Gathering: Arena for a 100% Winrate

## TLDR
I could make opponents concede at will so that I never lost

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Hey <a href="https://twitter.com/MTG_Arena?ref_src=twsrc%5Etfw">@MTG_Arena</a> I figured out how to make an opponent auto-concede the game. Let me know how you&#39;d like me to report the issue and I will send over the source + an explanation of how it can be mitigated. Thank you! <a href="https://t.co/dWMdkKjOA2">pic.twitter.com/dWMdkKjOA2</a></p>&mdash; Daniel Mayer (@dan__mayer) <a href="https://twitter.com/dan__mayer/status/1641669864460009472?ref_src=twsrc%5Etfw">March 31, 2023</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

## How
Card games are usually pretty tough targets for game hacks because they are turn based and not a lot of information needs to move between the client and the server. This means that card games are excellent candidates for being 100% server-side authoritative, meaning that the server keeps track of the entire game state and only tells the client what it needs to know. Unlike in a fast-paced shooter where the opponent team's models may need to be loaded before you can see them (allowing for wallhacks), or computationally heavy routines like player movement may be offloaded to the client to save resources (allowing for speedhacks), card games are relatively low computation and the information boundaries are concrete. All a player can really do is play cards, and read the board state. 

This means the client will do very little work itself and it will only be given information about an opponents' cards as the cards are played. Unrevealed information such as a player's hand or deck never exists locally so they cannot be read, and the actions a player can take are limited so the client does not need to be trusted and the logic to detect invalid potential invalid actions, like playing a card not in your hand are easy. That said, just because the logic to detect invalid actions are simple, does not mean that they are implemented. So I set about figuring out how to test them.

### The Basics of Online Game Hacking 

For any game the communicates with a server, your best bet is to skip straight 