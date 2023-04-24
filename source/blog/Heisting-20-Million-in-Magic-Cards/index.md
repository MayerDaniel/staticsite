# Heisting 20 Million Dollars' Worth of Magic: The Gathering Cards in a Single Request

### TLDR
With a little bit of math, decompilation, and understanding of computer architecture, I used a user-controlled arithmetic overflow in Magic: The Gathering Arena to buy millions of card packs for "free" (only using the starting amount of in-game currency given to new accounts). 

But the millions of dollars worth of digital cards isn't the reward here. The reward, hopefully, is knowledge. 

Tell 'em Tai:

 <video width="100%" controls>
 <source src="tai.mp4#t=0.001" type="video/mp4">
 </video>

<hr>

## Intro

**Digital trading card games** have put nerds in a bind. We used to be able to convince our life partners, and ourselves, that in some vague way we were really "investing" in collectibles that could be liquidated if needed. In recent years, though, digital card games like Hearthstone and its ilk have laid the facts bare for all to see: We are just gambling addicts with extra steps. Games like Magic: The Gathering Arena (MTGA) and Hearthstone are still massively popular and huge financial successes without any illusion of ownership or value in a secondary market. 

The cards "owned" by each account are all just numbers in a database somewhere. That change in ownership model is a double-edged sword though. Us nerds can change numbers in a database a lot more easily than we can rob a board game shop. So, let's take advantage of that!

## Casing the joint

MTGA is a Unity game, meaning that it is written in C#. C# decompiles extremely cleanly, making reverse engineering and manipulating the game logic a breeze. I covered this in more of a how-to format in [my last post](/blog/Unity-Hacking-101-Hacking-with-Reflection/), so I will skip it here and just get to the interesting part. Looking at the purchasing logic for in-game store items, the following function is used by the game to submit a purchase request using in-game currency:

```cs
...
// PurchaseV2Req is essentially a JSON dictionary that later 
// gets marshalled and sent to the game server to make a purchase
PurchaseV2Req purchaseV2Req = new PurchaseV2Req();
purchaseV2Req.listingId = item.PurchasingId;

// IMPORTANT LINE 1 - Sets quantity being ordered
purchaseV2Req.purchaseQty = quantity;

purchaseV2Req.payType = Mercantile.ToAwsPurchaseCurrency(paymentType, this._platform);

Client_PurchaseOption client_PurchaseOption = item.PurchaseOptions.FirstOrDefault(
    (Client_PurchaseOption po) => po.CurrencyType == paymentType);

// IMPORTANT LINE 2 - Calculates cost of order
purchaseV2Req.currencyQty = (
    (client_PurchaseOption != null) ? client_PurchaseOption.IntegerCost : 0) * quantity;

purchaseV2Req.customTokenId = customTokenId;
PurchaseV2Req request = purchaseV2Req;
...
}
```

When I took a look at this, it stood out to me that the request to purchase something from the store includes both the quantity being ordered _and_ a calculated price of what the order should cost, which is calculated by the client(!) by multiplying the unit price of whatever is being purchased by the quantity being ordered. If that second important line is confusing to you, it can be written in the following more-readable way:

```cs
if (client_PurchaseOption != null) {
    purchaseV2Req.currencyQty = client_PurchaseOption.IntegerCost * quantity;
} else {
    purchaseV2Req.currencyQty = 0 * quantity;
}
```

Seeing a price calculation being performed client-side made me immediately begin the classic QA-engineer-beer-ordering workflow:

<blockquote class="twitter-tweet tw-align-center" style="margin: auto;"><p lang="en" dir="ltr">A QA engineer walks into a bar. Orders a beer. Orders 0 beers. Orders 99999999999 beers. Orders a lizard. Orders -1 beers. Orders a ueicbksjdhd. <br><br>First real customer walks in and asks where the bathroom is. The bar bursts into flames, killing everyone.</p>&mdash; Brenan Keller (@brenankeller) <a href="https://twitter.com/brenankeller/status/1068615953989087232?ref_src=twsrc%5Etfw">November 30, 2018</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>


First I tried messing with the `purchaseQty` field by setting it to a negative number, just to see if there was any weird behavior there. My hope was that the logic for deducting a payment from my account serverside would look something like this:

```cs
accountBalance -= client_PurchaseOption.IntegerCost * quantity
```

If I purchased -1 card packs from the store, at a price of 200 gems (MTGA's in-game currency), `purchaseV2Req.currencyQty` would equal -200. Subtracting that from my account balance would give me more money!

This did not work. The server checks to make sure that you are ordering a quantity greater than 0, and prevents the purchase from going through if not.

I then tried messing with `currencyQty`, the calculated price. I thought this was going to be a winner and that I would be able to purchase whatever I wanted for 0 gems. No dice there either. If I tried to change the calculated price, I would get the following error back, due to a mismatch with a price calculation performed server-side:

```json
{
  "code": "Store_IncorrectCurrency",
  "message": "Failed to purchase listing because currencyQuantity is not equal to calculated price"
}
```

Ok, weird. That means that the client has to send a correctly calculated price in the purchase order, because the server validates the order by performing its own price calculation. While this left me stumped as to why the client-side calculation even exists, it meant I couldn't just tell the game to give me free cards, or negative cards, or whatever.

But I wasn't ready to give up yet. The fact that I could see the logic of how this price calculation was made allowed me to make some assumptions about the server-side check:

* The same arithmetic is likely used server-side to validate a purchase request
* It is potentially the _exact_ same implementation, meaning whatever server-side application is receiving my requests is also written in C#

Now that second bullet is a pretty big jump in reasoning, but I was willing to roll with it because it opened up the opportunity to make a purchase that was _technically_ correct, but still let me make out like a bandit.


## The heist

An arithmetic overflow occurs when the output of an operation is a value bigger than can be stored in the destination data type. In our case, we are talking about the `int` data type. In C#, an `int` is represented under the hood as 4 bytes, or 32 bits. In hex, the max value that this 4-byte value could be is `0xFFFFFFFF`, or `11111111111111111111111111111111` in binary. 

What happens when you add `1` to `11111111111111111111111111111111`?

```txt
  11111111111111111111111111111111
+ 00000000000000000000000000000001
----------------------------------
 100000000000000000000000000000000
```

 It should become `100000000000000000000000000000000`, but that is 33 bits - one bit more than what our data type allows. So instead, the most significant bit is dropped, leaving us with `00000000000000000000000000000000`. It rolls back over to zero. 
 
 Now, the `int` representation of `11111111111111111111111111111111` is actually `-1` in C# due to the use of [two's complement](https://en.wikipedia.org/wiki/Two%27s_complement) to allow the data type to store negative numbers. This means that the overflow kind of works as intended. When you add `1` to `-1`, both the underlying binary and the `int` representation zero out. `00000000000000000000000000000000` = `0`. But you don't need to worry about that. All you need to know is that if the output of an operation is greater that `0xFFFFFFFF`, the output value will essentially be `output % 0xFFFFFFFF`.

So, with our new knowledge of arithmetic overflows, do you see how we are going to heist our Magic cards? Looking back at this line of code, I see two things:

```cs
purchaseV2Req.currencyQty = client_PurchaseOption.IntegerCost * quantity;
```

* There aren't any checks for overflows
* The user controls one of those variables

So, if we are assuming that the server logic is similar to what is done on the client side, we should be able to overflow this integer by ordering an astronomically high number of packs. Let's plug some numbers in!

One pack of cards costs `200` gems. We can't change this, so it is a constant.

We also can't change the rules of C#'s `int` data type. We know the max underlying value is `0xFFFFFFFF`.

With that, we can figure out how many packs we'd need to order to overflow our order price back around past `0`, and only pay for the remainder. A Python interpeter will do just fine:

```python
>>> (0xFFFFFFFF/200) + 1 # add one to round up to the nearest int that will overflow
21474837
```

We add `1` to the quotient to get the largest whole number that will surpass the overflow, since Python always rounds down when casting `float`s to `int`s. This means while we are ordering 21 million packs, our payment will be as close to `0` as feasibly possible. Potentially under the price of a single pack!

<hr>

Oh, there's something else I fogot to mention. There's no way to actually submit bulk orders for an arbitrary number of packs in the UI. There's just a big button to buy a pack (and preset quantities of 10, 25, etc):

![pack](pack.png)

But that's no problem, since we know the price of the item is 200 gems, we can just patch our binary with the appropriate opcodes to have the quantity hardcoded into our order! In C# it would look like this:

```cs
...
// PurchaseV2Req is essentially a JSON dictionary that later 
// gets marshalled and sent to the game server to make a purchase
PurchaseV2Req purchaseV2Req = new PurchaseV2Req();
purchaseV2Req.listingId = item.PurchasingId;

// Important Line 1 - Sets quantity being ordered
purchaseV2Req.purchaseQty = quantity * 21474837;

purchaseV2Req.payType = Mercantile.ToAwsPurchaseCurrency(paymentType, this._platform);

Client_PurchaseOption client_PurchaseOption = item.PurchaseOptions.FirstOrDefault(
    (Client_PurchaseOption po) => po.CurrencyType == paymentType);

// Important Line 2 - Calculates cost of order
purchaseV2Req.currencyQty = (
    (client_PurchaseOption != null) ? client_PurchaseOption.IntegerCost : 0) * quantity * 21474837;

purchaseV2Req.customTokenId = customTokenId;
PurchaseV2Req request = purchaseV2Req;
...
}
```
And in case you're wondering why I didn't just recreate the purchase request in python or something, it is because the shop communication is over some sort of socket. It wasn't just a REST api and it didn't seem worth figuring out.

So with the binary patched, lets click our button and buy a pack...

 <video width="100%" controls>
 <source src="packs.mp4#t=0.001" type="video/mp4">
 </video>

Bada-bing, bada-boom. With a single click, over 20 million dollars worth of Magic cards has been deposited to my account (if you calculate the gems-to-dollars exchange rate, a conservative estimate is each pack costs a little over a dollar). 

How much did that put us back? Well, we can do the math ourselves:

```python
>>> (200 * 21474837) % 0xFFFFFFFF
105
```

105 gems! Less than the cost of a single pack. We can check the purchase logs just to be sure though:

```json
{
 {
  "InventoryInfo": {
    "SeqId": 5,
    "Changes": [
      {
        "Source": "MercantilePurchase",
        "SourceId": "Packs-KHM-1-Listing",
        "InventoryGems": -104,
        "InventoryCustomTokens": {},
        "ArtStyles": [],
        "Avatars": [],
        "Sleeves": [],
        "Pets": [],
        "Emotes": [],
        "Decks": [],
        "DecksV2": [],
        "DeckCards": {},
        "Boosters": [
          {
            "CollationId": 100022,
            "SetCode": "KHM",
            "Count": 21474837
          }
        ],
    ...
```

Yup! In fact we get an extra gem off compared to our Python calculation. Not sure where that one got added or lost between the two calculations. 

Each account in MTGA starts with 250 gems which can be used to get hooked on the delicious sensation of opening packs. This means that without spending any money, you can _really_ start filling out your collection. 

## A final twist

Another twist here is that there are a finite number of cards per set, and you can only open 4 copies of each card before they become useless since you can't use more than 4 copies of a card in a deck. So what happens when you open so many packs that you reach the limit? I set up my autoclicker and found out. Once you cannot collect any more cards, the packs instead _refund you gems_

![free gems](gems.png)

And let me tell you, you hit the card limit looooooong before you are even through your first 10,000 packs for whatever set you bought. This then gives you an nigh-infinite trove of gems to go out and buy 21 million packs of each of the other sets with! Or buy cosmetics, or participate in events, or whatever. MTGA just became **truly** free-to-play!

## Conclusion

I hope this has been an illustrative example of the power of a simple bug. Just because a bug is simple, don't assume that it isn't there. Most of the crazy zero-click remote code execution exploits used today also stem from simple missed checks on user-controlled variables. Ian Beer, one of the most talented vulnerability researchers in the world, sometimes just sits down and looks for `memmove` calls in the iOS kernel with controllable input. This led to him discovering [a wormable, zero-click, remote code execution exploit over radio](https://googleprojectzero.blogspot.com/2020/12/an-ios-zero-click-radio-proximity.html). But that stuff is the big leagues. For now, I am content just being able to build some new decks with my bug hunting :)

There is also something to be said here about the value of digital goods. Frankly, I have no dog in that fight. The reality is that they do and will continue to exist, and that things like this are a side effect of that reality. If you are looking for some more thoughts to chew on in this space, I recommend [_CONTENT: Selected Essays on Technology, Creativity, Copyright and the Future of the Future_ by Cory Doctorow](https://craphound.com/content/Cory_Doctorow_-_Content.html). It is published for free in its entirety that link.

