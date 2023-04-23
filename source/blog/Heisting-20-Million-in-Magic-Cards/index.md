# Heisting 20 Million Dollars' Worth of Magic: The Gathering Cards in a Single Request

## TLDR
With a little bit of math, decompilation, and understanding of computer architecture, a user-controlled arithmetic overflow in Magic: The Gathering Arena was used (by me) to buy millions of card packs for "free" (only using the starting amount of in-game currency given to new accounts). 

<hr>

**Digital trading card games** have put nerds in a bind. We used to be able to convince our life partners, and ourselves, that in some vague way we were really "investing" in collectibles that could be liquidated if needed. But Hearthstone and its ilk have laid the facts bare for all to see: We are just gambling addicts with extra steps. Games like Magic: The Gathering Arena (MTGA) and Hearthstone are still massive popular and financial successes without the illusion of ownership or an avenue to make back some of our investment. 

The cards "owned" by each account are all just numbers in a database somewhere. That change in ownership structure is a double-edged sword though. I can change a number in a database a lot more easily than I can rob a board game shop. So, let's take advantage of that!

## Casing the joint

MTGA is a Unity game, meaning that it is written in C#. C# decompiles extremely cleanly, making reverse engineering and manipulating the game logic a breeze. I covered this in more of a how-to format in [my last post](/blog/Unity-Hacking-101-Hacking-with-Reflection/), so I will skip it here and just get to the interesting part. Looking at the purchasing logic for in-game store items, the following function is used by the game to submit a purchase request using in-game currency:

```cs
            ...
            // PurchaseV2Req is essentially a JSON dictionary that later 
            // gets marshalled and sent to the game server to make a purchase
			PurchaseV2Req purchaseV2Req = new PurchaseV2Req();
			purchaseV2Req.listingId = item.PurchasingId;
            
            // Important Line 1 - Sets quantity being ordered
			purchaseV2Req.purchaseQty = quantity;
			
            purchaseV2Req.payType = Mercantile.ToAwsPurchaseCurrency(paymentType, this._platform);
			
            Client_PurchaseOption client_PurchaseOption = item.PurchaseOptions.FirstOrDefault(
                (Client_PurchaseOption po) => po.CurrencyType == paymentType);
			
            // Important Line 2 - Calculates cost of order
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

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">A QA engineer walks into a bar. Orders a beer. Orders 0 beers. Orders 99999999999 beers. Orders a lizard. Orders -1 beers. Orders a ueicbksjdhd. <br><br>First real customer walks in and asks where the bathroom is. The bar bursts into flames, killing everyone.</p>&mdash; Brenan Keller (@brenankeller) <a href="https://twitter.com/brenankeller/status/1068615953989087232?ref_src=twsrc%5Etfw">November 30, 2018</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

First I tried messing with the `purchaseQty` field by setting it to a negative number, just to see if there was any weird behavior there. My hope was that the logic for deducting a payment from my account serverside would look something like this:

```cs
accountBalance -= purchaseV2Req.currencyQty
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

* It is likely the same arithmetic to determine price server-side
* It is potentially the _exact_ same implementation, meaning whatever server-side application is receiving my requests is also written in C#

Now that second bullet is a pretty big jump in reasoning, but I was willing to roll with it because it opened up the opportunity to make a purchase that was _technically_ correct, but still let me make out like a bandit.

## Before we heist, primer on arithmetic overflows and two's complement

<mark>Disclamer: Two's complement is very hard to explain in words in a way that doesn't feel totally meaningless. If this section makes no sense, try playing with the fiddles some in conjunction with watching [this video](https://www.youtube.com/watch?v=4qH4unVtJkE). Or just skip it altogether. That's what I did in college and it worked for me!</mark>

So, an arithmetic overflow occurs when the output of an operation is a value bigger than can be stored in the destination data type. In our case, we are talking about the `int` data type. In C#, an `int` is represented under the hood as 4 bytes, or 32 bits. In hex, the max value that this 4-byte value could be is `0xFFFFFFFF`, or `11111111111111111111111111111111` in binary. 

The max decimal number that can be stored in an `int` is not `4,294,967,295`, which is the unsigned decimal equivalent to `0xFFFFFFFF`. If that were the case, there would be no way to represent negative numbers, as all of the possible combinations of binary that could fit in those four bytes would just represent their positive equivalents in decimal. 

Instead, [two's complement](https://en.wikipedia.org/wiki/Two%27s_complement) is used to allow the 4 bytes to represent any number in the range `-2,147,483,648` to `2,147,483,647`. A number's value in that range can be converted to its negative equivalent in binary in the following three steps:

* Step 1: starting with the equivalent positive number.
* Step 2: inverting (or flipping) all bits – changing every 0 to 1, and every 1 to 0;
* Step 3: adding 1 to the entire inverted number, ignoring any overflow. Failing to ignore overflow will produce the wrong value for the result.

(These steps are from the Wikipedia for two's complement [linked above](https://en.wikipedia.org/wiki/Two%27s_complement), in which there is also a basic example).

It is ok if you don't understand how two's complement works after those few vague sentences, I think every programmer has lost count of how many times they've had the concept explained to them without it making a dent in their understanding. I don't have any misconceptions that I am going to do better. 

The main gist is that you cannot fit infinite numbers into finite space. For the `int` data type in C#, the bounds are `-2,147,483,648` to `2,147,483,647`, because our finite space is 4 bytes. And to get the negative numbers in there, half the numbers are reserved to be negative, meaning there is a boundary somewhere between positive and negative numbers.

Speaking of boundaries, ask yourself this question: what happens if you add `1` to an `int` holding `2,147,483,647` in C#?

This is a great question! And represents one of the most common classes of arithmetic overflows that programmers forget to think about.

If you increment `2,147,483,647`, you overflow into the negative number representations, and in fact start at the largest negative number, `-2,147,483,648`, due to how two's complement works. You can see for yourself in the following fiddle. Type `1` into it and press enter:

<iframe width="100%" height="475" src="https://dotnetfiddle.net/Widget/xlxkNf" frameborder="0"></iframe>

The reason that two's complement is so brilliant is exactly the phenomenon that you are seeing above. 

It may seem wonky at first that `01111111111111111111111111111111`, which equals `2,147,483,647`, becomes `-2,147,483,648` when the underlying binary has `1` added to it and becomes `10000000000000000000000000000000`, but the brilliance is that the binary operations your computer is doing under the hood don't have to change to work appropiately for negative numbers past this boundary. 

Rerun the fiddle above but instead add `2`. You'll see that `10000000000000000000000000000001` equals `-2,147,483,647`. If you add more, you'll see that the negative numbers move towards 0 when added to, even though the underlying binary just continues to increment up as normal. So, in deciding to have this weird boundary, at `2,147,483,647` and `-2,147,483,648` the smart cookies who designed how software would integrate with computer architecture saved themselves a lot of work with handling negative numbers in all other cases. 

That "one weird boundary" can cause a lot of bugs though. Programmers who forget to safeguard against it can end up with lots of unintended behavior when a big positive number suddenly becomes a big negative one and vice-versa.

OK! So armed with this knowledge, can you figure out what decimal number is represented by `11111111111111111111111111111111`?

If you guessed `-1`, you are correct! Since we know past `10000000000000000000000000000000` that adding will move the decimal representation closer to `0`. Our maximum binary value gets us as close as possible in the decimal representation: `-1`.

And what happens, then, when you add `1` to `-1`? You get `0`! Two's complement essentially turns the binary overflow into intended behavior - when you add `1` to `11111111111111111111111111111111`, it resets to all `0`s, and in decimal this also equals `0`!

You can check it out in the fiddle below to understand a little bit better:

<iframe width="100%" height="475" src="https://dotnetfiddle.net/Widget/sEH4yC" frameborder="0"></iframe>

Great, you got all that, right? Do you remember that we were talking about Magic: The Gathering at the beginning of all this?

## The heist

So, with our new knowledge of arithmetic overflows, do you see how we are going to heist our magic cards? Looking back at this line of code, I see two things:

```cs
purchaseV2Req.currencyQty = client_PurchaseOption.IntegerCost * quantity;
```

* There aren't any checks for overflows
* The user controls one of those variables

So, if we are assuming that the server logic is similar to what is done on the client side, we should be able to overflow this integer by ordering an astronomically high number of packs. Let's plug some numbers in!

One pack of cards costs 200 gems. We can't change this, so it is a constant.

We also can't change the rules of C#'s `int` data type. The max underlying value is `0xFFFFFFFF` and the max positive integer representation is `0x7FFFFFFF`.

With that, we can figure out how many packs we'd need to order to overflow our order price to be negative, and get paid to order packs! Any old python interpeter will do:

```python
>>> (0x7FFFFFFF/200) + 1 # add one to round up to the nearest int that will overflow
10737419
```

There's something else I fogot to mention. There's no way to actually submit bulk orders for an arbitrary number of packs in the UI. There's just a big button to buy a pack (and present quantities of 10, 25, etc):

![pack](pack.png)

But that's no problem, since we know the price of the item is 200 gems, we can just patch our binary with the appropriate opcodes to have the quantity hardcoded into our order! In C# it would look like this:

```cs
            ...
            // PurchaseV2Req is essentially a JSON dictionary that later 
            // gets marshalled and sent to the game server to make a purchase
			PurchaseV2Req purchaseV2Req = new PurchaseV2Req();
			purchaseV2Req.listingId = item.PurchasingId;
            
            // Important Line 1 - Sets quantity being ordered
			purchaseV2Req.purchaseQty = quantity * 10737419;
			
            purchaseV2Req.payType = Mercantile.ToAwsPurchaseCurrency(paymentType, this._platform);
			
            Client_PurchaseOption client_PurchaseOption = item.PurchaseOptions.FirstOrDefault(
                (Client_PurchaseOption po) => po.CurrencyType == paymentType);
			
            // Important Line 2 - Calculates cost of order
            purchaseV2Req.currencyQty = (
                (client_PurchaseOption != null) ? client_PurchaseOption.IntegerCost : 0) * quantity * 10737419;
			
            purchaseV2Req.customTokenId = customTokenId;
			PurchaseV2Req request = purchaseV2Req;
			...
		}
```
In case you're wondering why I didn't just recreate the purchase request in python or something, it is because it is over some sort of socket. It wasn't just a REST api and it didn't seem worth figuring out.

So an overflow to a negative number didn't work:

```json
{
  "code": "InvalidParams",
  "message": "CurrencyQty must be >= 0"
}
```

Which means our final chance is to overflow the `int` completely to circle around down back close to zero.