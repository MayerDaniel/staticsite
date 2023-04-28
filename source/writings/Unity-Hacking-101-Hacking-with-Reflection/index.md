# Unity Hacking 101: Hacking with Reflection

_This tutorial is for Windows machines and intended to be followed step-by-step. Associated materials can be found on GitHub [HERE](https://github.com/MayerDaniel/UnityHacking)_.

_This tutorial is pretty verbose and details a lot of gotchas I encountered using Visual Studio and Unity for the first time. If you just want to learn about how to access game objects at runtime using reflection, [skip to the end](#interestingbit)._

## Intro

I recently participated in the [Global Game Jam](https://globalgamejam.org/) at the _very_ cool developer collective [Glitch City](https://glitch.city/), where I spent 48 hours creating a game in Unity with a team of gamedev professionals and a few novices like me. My contributions were modest and filled with spaghetti but with the help of the great game programmers on my team, I got a much better understanding of the basics of how the engine works.

During the jam, I chatted a bit with the developers on my team about my day job as a malware reverse engineer. I said that at the end of the jam we could take our game apart together as a little bit of a skill share in repayment for the wealth of Unity knowledge they were imparting on me during the jam. Well, if you know anything about how game jams go, the end was frantic (but fun!), and generally felt like this:

![The jam](jam.jpg)

So there was no time or energy left for reverse engineering :(. But that means I get to make a tutorial for anyone to check out instead! And over the course of the jam I realized that Unity is a perfect place to start for game hacking/modding a few reasons:

* Unity is written in C#, a programming language for the .NET framework, which allows us to make use of [Reflection](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/reflection), a very powerful tool built into .NET that allows for the introspection and manipulation of running processes - we will talk more about this further down.

* Compiled C# code also decompiles incredibly cleanly and with symbols, making Unity games a great place to start as well if you are interested in reverse engineering in general.

To first get a handle on the basics of Unity's architecture though, let's first do some plain ol' forward engineering.

## Snake: a Unity primer

Behold our incredibly complex "hacking" target:

![Snake](snake.png "Our target")

In the field of reverse engineering software, I find the best way to wrap my head around something is to build a toy version of it and then look at it in a decompiler. I couldn't think of anything more basic than snake in that regard. It also had a lot of openly available tutorials online. To get a basic understanding of how the engine works, I recommend you follow this tutorial to make a very simple snake game:

[Unity 2D Snake Tutorial](https://noobtuts.com/unity/2d-snake-game)

It does not take long, I promise. This will get you acquainted with the basic concepts of GameObjects and how C# scripting works within the engine to construct the game logic.

<mark>PLEASE NOTE: Unity version matters!! I made my version of snake with 2021.3.16f1 - you should too! Otherwise some of my code further down may not work for you.</mark>

If you don't want to walk through it or are already familiar with Unity, I have included my build of the game on GitHub [HERE](https://github.com/MayerDaniel/UnityHacking/blob/main/101/snakebuild.zip?raw=true) (clicking this will download the zip file). The only difference between my build and the tutorial is I added the following line to reload the scene when you die:

```cs
SceneManager.LoadScene(SceneManager.GetActiveScene().name);
```

Now that we have our game to hack, let's hack it! Snake is nice because there's only one real way to cheat - we are going to give ourselves more tail squares without eating food. Lets figure out how to do that.

## DNSpy: A first foray into reverse engineering

For this part, we will need to download a .NET decompiler. This will allow us to look at our compiled snake game to get an idea of what Unity games look like when they are shipped. I recommend DNSpy since it also allows for debugging .NET assemblies relatively easily, even though we won't be doing that in this tutorial. It can be found [HERE](https://github.com/dnSpyEx/dnSpy). You can download a built copy of DNSpy under the "tags" tab on that page:

![Tag location](tags.png "Tag location")

If you followed the tutorial, first build your game to a known location. Otherwise, unzip [my included build](https://github.com/MayerDaniel/UnityHacking/blob/main/101/snakebuild.zip?raw=true) to a known location. Navigate there and find the file located at `.\snake_Data\Managed\Assembly-CSharp.dll`. For most games, this is the file that holds most of the basic game logic written by the developers. Drag this into the sidebar of DNSpy to decompile it.

In the sidebar, you should now be able to open up the default namespace inside of `Assembly-CSharp.dll`, which looks like little brackets with a dash next to them (`{} -`), and inspect the game logic of the classes within our snake game:

![DNSpy Sidebar](sidebar.png)

The nice thing about mucking around with other people's code is there are no rules about how you accomplish your goals. The path you take to give yourself extra tail squares on your snake is up to you. In my case, I took a look at the `Move` function inside the `Snake` class. Here is the decompiled function from DNSpy, copy/pasted here:


```cs
// Token: 0x02000002 RID: 2
public class Snake : MonoBehaviour
{
	// Token: 0x06000001 RID: 1 RVA: 0x00002050 File Offset: 0x00000250
	private void Move()
	{
		this.dir = this.tickDir;
		Vector2 v = base.transform.position;
		base.transform.Translate(this.dir);
		if (this.ate)
		{
			GameObject gameObject = Object.Instantiate<GameObject>(this.tailPrefab, v, Quaternion.identity);
			this.tail.Insert(0, gameObject.transform);
			this.ate = false;
			return;
		}
		if (this.tail.Count > 0)
		{
			this.tail.Last<Transform>().position = v;
			this.tail.Insert(0, this.tail.Last<Transform>());
			this.tail.RemoveAt(this.tail.Count - 1);
		}
	}
```

Great. So a quick look at this shows that there is a check within the `Move` function for the value of the boolean `ate`. If `ate` is true, then we add to the tail. That means one way that we can ensure we add a square to our tail is to set `ate` to `true` for our snake, then call `Move`. We've already looked at the move function, so let's check out the `ate` field.

You can right click `this.ate` within the `Move` function in DNSpy and select `Analyze` in the menu that pops up. This will create a new analyzer window at the bottom that shows you where `this.ate` gets set and read, but we don't care about because we are going to set it ourselves (checking these out could reveal another way to accomplish adding a tail, though!). For our method of adding to our tail we care more about the details of the `ate` field itself. For that, click `Snake.ate` in the Analyzer:

![Analyzer](analyzer.png)

This will bring you to its definition within the `Snake` class, which I have included below:

```cs
// Token: 0x04000004 RID: 4
	private bool ate;
```

Ok, so it is a boolean, and it is a private variable belonging to the class `Snake`. "Oh no!" you might say - "that means that no function outside the `Snake` class can access that class! This tutorial is over!" to which I say, cut the histrionics! Where there is a will there's a way. And that way is reflection!

## Reflection is the coolest part of .NET

Now,  in a game compiled in C, we would probably just find the struct of our instantiated `Snake` object once the game starts, then flip the bit associated with the `ate` boolean to true. Which is very cool and hackery and you can check out my other tutorial on [finding and altering offsets in memory](/writings/Process-Injection-102-VirtualProtect) to see how to do something like that. But in .NET you can do something even cooler and hackery-er. You can write code that finds, reads, and alters instantiated objects as a built-in feature of .NET!

Using reflection, our basic game plan will be this:

1. Get code execution into the snake game at runtime through process injection.
2. Create a Unity GameObject that uses reflection to find the snake object in memory and alter it.
3. Have Unity load our GameObject into the game, at which point it will flip `ate` for the snake object in-game to true and grow our tail.

## Injecting into the game

For this tutorial, we are going to let steps 1 and 3 be taken care of by talented folks over at https://www.unknowncheats.me/, an awesome online resource for learning about game hacking. Someone there maintains a Unity injector that does a lot of the hard work of injecting into a Unity process and getting the CLR to run injected code.

Building the injector is far more complex than what we are doing here, and while I am interested in recreating an injector for Unity one day, that ain't no 101 class! The injector we are going to use is called `SharpMonoInjector` and you can find it [HERE](https://github.com/warbler/SharpMonoInjector).

Same as with DNSpy, there is a compiled release under "tags" on the GitHub page. You can use either the GUI or CLI version, I will be using the CLI in my examples. Make sure you keep all contents of the zip you download in the same directory.

## Building a Proof of Concept

### Project Setup

We can break building our payload into two steps. The first step is to build a test payload to show that we are executing code in Unity, which will get us set up with our boilerplate code. Then we can actually implement our cheat.

There are a few gotchas with how you need to set up your Visual Studio project, so let's go through it together.

First create a new "Class Library" project in Visual Studio.

![Project](project.png)

When clicking through the options of creating your project, ensure that on the "Additional Information" page you select the target framework to be ".NET Standard 2.1", as this is the .NET profile that Unity supports by default, and will be the profile of our snake game.

![Standard](standard.png)

### Loader Boilerplate

Now, we will create our boiler plate loader. This is the class expected by our injector, and it mainly just creates a class from another namespace we will define and put all of our cheat logic in. This boilerplate is from a great primer on Unity hacking posted on Unknown Cheats [HERE](https://www.unknowncheats.me/forum/unity/285864-beginners-guide-hacking-unity-games.html) - which was a really great resource for me. Honestly most of this post is redundant information from that post except for how to use reflection. Anyway, here's the boilerplate:


```cs
using System;
// We will import this straight from the game files!
using UnityEngine;
// Our namespace, which we will create in another file
using hax;


namespace cheat
{
    public class Loader
    {
        public static GameObject L;
        public static void Load()
        {

            // Create an instance of the GameObject
            Loader.L = new GameObject();

            // Add our class that will contain all of the cheat logic
            Loader.L.AddComponent<hax.Hacks>();

            // Tell Unity not to destroy our GameObject on level change
            UnityEngine.Object.DontDestroyOnLoad(Loader.L);
        }

        public static void Unload()
        {
            // Destroy our GameObject when called
            UnityEngine.Object.Destroy(L);
        }
    }

}
```

Now, give it a readover here because when you paste this into Visual Studio it will be full of red squigglies. That is because we haven't created our other file, which will contain the namespace `hax` and the class `hax.Hacks` yet, and we also haven't imported the Unity engine as a dependency. This is one of the other things that makes hacking games with a .NET engine so fun - you can give Visual Studio the actual DLLs shipped with the game as dependencies and they integrate seamlessly with the IDE!

To add the Unity engine, go to your solution explorer and right click on "Dependencies > Add Project Reference".

![Dependencies](dependency.png)

In the new dialogue, then press "Browse" on the left sidebar, and "Browse" again on the bottom bar. You'll see that I have already added a bunch of DLLs from Unity games so they show up in my history, but those won't be there when you open up this dialogue for the first time.

![Browse](browse.png)

When the file selection dialogue pops up, navigate to the same `.\snake_Data\Managed\` directory inside the Snake build that you found `Assembly-CSharp.dll` in. Select `UnityEngine.dll` as your file to import. Now do the same to add `UnityEngine.CoreModel.dll`. Once these have both been added as dependencies in your project you will be able to reference Unity engine functions and classes like `GameObject` in your code.

Great! A lot of red squigglies should now be gone. Now, let's make a first-pass "hack" that will display a text box in game, and test it to ensure we have execution inside our game process.

### Injecting a GUI into the game

As our first pass in getting code execution within snake, we will make a small GUI component show up in the game, since we will want to tie our "hack" to a button within the game anyway. To do this we will make a new file within our visual studio project with the following boilerplate:


```cs
using System;
using UnityEngine;

namespace hax
{
    public class Hacks : MonoBehaviour
    {
        public void OnGUI()
        {
            //GUI code goes here!
        }
    }
}
```

The namespace `hax` and the class `Hacks` are just throwaway names, but the function `OnGUI` is an inherited function of every object within the Unity engine, and is the only function used for rendering and handling GUI events. In case you are wondering, the base object within the Unity engine is the `MonoBehavior` class that we are extending.

The following code is the most basic UI we can make, it is just a box with a label that then holds a small button, also with a label:

```cs
// Taken pretty much verbatim from https://docs.unity3d.com/ScriptReference/GUI.Window.html
public void OnGUI()
        {
            // Create a window at the center top of our game screen that will hold our button
            Rect windowRect = new Rect(Screen.width / 2, Screen.height / 8, 120, 50);

            // Register the window. Notice the 3rd parameter is a window function to make the window contents, defined below
            windowRect = GUI.Window(0, windowRect, DoMyWindow, "HackBox");

            // Make the contents of the window
            void DoMyWindow(int windowID)
            {
                // Combo line that creates the button and then also will check if it has been pressed
                if (GUI.Button(new Rect(10, 20, 100, 20), "Add Tail"))
                {
                    // Logic to add a tail should be added here!
                }
            }
        }
```

When you save this code, you will notice that the `GUI` object is not defined. We will need to add another dependency for that, in this case the dll `UnityEngine.IMGUIModule.dll`, also found in the `Managed` directory. You should be now be able to check on both .cs files you have created in your Visual Studio project and there should be no errors in either of them.

We are now ready to compile and load up our "hack" into an instance of the game. Wahoo!

Build your Visual Studio project and take note of the filepath of the built DLL. We will need to feed this to SharpMonoInjector, along with the namespace, class, and function name of our loader class within the loader boilerplate code we made.

## Testing out the injector

Open a command prompt and navigate to the directory you downloaded SharpMonoInjector to and run it without arguments to see its help statement:

```console
 .\smi.exe
SharpMonoInjector 2.2

Usage:
smi.exe <inject/eject> <options>

Options:
-p - The id or name of the target process
-a - When injecting, the path of the assembly to inject. When ejecting, the address of the assembly to eject
-n - The namespace in which the loader class resides
-c - The name of the loader class
-m - The name of the method to invoke in the loader class
```

Now, run snake, then alt-tab to the command line window and inject your DLL. For our game, your injection command will look something like this:

```console
 .\smi.exe inject -p snake -a <path to built DLL> -n cheat -c Loader -m Load
```
If the injection is successful, SharpMonoInjector will print of the offset of the injected DLL. You will also see your UI show up in the game of snake. If this fails, try running the command again from an elevated command prompt. Sometimes Microsoft Defender also doesn't like process injection tools since a lot of malware uses process injection. You can try turning off Defender as well if it still isn't working and that doesn't skeeve you out. If all goes well you should see something like this in-game:

![Hacked!](hacked.png)

If you see that box in the game, it means you have successfully achieved code execution in the Unity game. Well done. Now let's add that tail!
<div id="interestingbit"></div>

### Adding the tail using reflection

Reflection is useful for accessing and manipulating instantiated objects at runtime. Unity also has some great built-in functions for this. We will use both for implementing our function to add a tail square.

First lets get our snake object that has been instantiated. Unity has a function `GameObject.FindObjectOfType<T>` for this exact purpose.

```cs
Snake snake = GameObject.FindObjectOfType<Snake>();
```

Note that this function only returns the first instance of the object found, so it is really only useful in cases where you know there is only one instance of an object that exists. Otherwise you can use `GameObject.FindObjectsOfType<T>` to get back an array of all objects that you can iterate through to find the object you are looking for, or to manipulate all of them at once.

For our hack to understand the `Snake` class, we will need to add `Assembly-CSharp.dll`, the DLL with our game's logic that we looked at earlier in DNSpy, as a dependency to the project.

We can now create a generic `Type` object for the type `Snake` in our code:

```cs
// Create a "Type" object for the type "Snake"
Type snakeType = snake.GetType();
```

Now let's flip our snake's `ate` field to true. We will use reflection to create a `FieldInfo` object for the specific `ate` field within the `Snake` object.

```cs
// Use System.Reflection.FieldInfo object to discover the attributes of the field and provide access to its metadata
// https://learn.microsoft.com/en-us/dotnet/api/system.reflection.fieldinfo?view=net-7.0
FieldInfo ateField = snakeType.GetField("ate", flags);
```

Notice the second argument `flags`. We need to use Reflection's [BindingFlags](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.bindingflags?redirectedfrom=MSDN&view=net-7.0) to describe what sort of variable our target field is declared as:

* `BindingFlags.Instance`: This is what allows us to access the variable of an instantiated object
* `BindingFlags.Public`: Public variables
* `BindingFlags.NonPublic`: Private variables
* `BindingFlags.Static`: Static variables

Since the flags can be `OR`ed together and it doesn't matter if a variable _doesn't_ have one of the attributes we set in the BindingFlags, we can cast a wide net and cover most of the types of variables we would encounter within a Unity object.

```cs
// Cast a wide net with our BindingFlags to catch most variables we would run into. Scope this down as needed.
// https://learn.microsoft.com/en-us/dotnet/api/system.reflection.bindingflags?redirectedfrom=MSDN&view=net-7.0
 BindingFlags flags = BindingFlags.Instance
 		| BindingFlags.Public
		| BindingFlags.NonPublic
		| BindingFlags.Static;
```

If you encounter a class with both a public and private variable of the same name or some other sort of collision, scope this down as needed. But usually it is ok to just yolo it.

The syntax of altering a field within an object using reflection is a bit strange. The `FieldInfo` object is actually what has the method to do so. The `SetValue` method takes two arguments: an object that contains the field and the value you want to set the field to be. For us this is the value `true`.

```cs
// Set the value of the "ate" field within our game's Snake object to true
ateField.SetValue(snake, true);
```

Now lets put it all together into our working snake "hack":

```cs
using System;
using UnityEngine;
using System.Reflection;

namespace hax
{
    public class Hacks : MonoBehaviour
    {
        // Cast a wide net with our BindingFlags to catch most variables we would run into. Scope this down as needed.
        // https://learn.microsoft.com/en-us/dotnet/api/system.reflection.bindingflags?redirectedfrom=MSDN&view=net-7.0
        BindingFlags flags = BindingFlags.Instance
               | BindingFlags.Public
               | BindingFlags.NonPublic
               | BindingFlags.Static;

        // Unity Engine reserved function that handles UI events for all objects
        // Taken pretty much verbatim from https://docs.unity3d.com/ScriptReference/GUI.Window.html
        public void OnGUI()
        {
            // Create a window at the center top of our game screen that will hold our button
            Rect windowRect = new Rect(Screen.width / 2, Screen.height / 8, 120, 50);

            // Register the window. Notice the 3rd parameter is a callback function to make the window, defined below
            windowRect = GUI.Window(0, windowRect, DoMyWindow, "HackBox");

            // Make the contents of the window
            void DoMyWindow(int windowID)
            {
                // Combo line that creates the button and then also will check if it has been pressed
                if (GUI.Button(new Rect(10, 20, 100, 20), "Add Tail"))
                {
                    this.AddTail();
                }
            }
        }

        public void AddTail()
        {
            // Get the instantiated Snake GameObject
            Snake snake = GameObject.FindObjectOfType<Snake>();

            // Create a "Type" object for the type "Snake"
            Type snakeType = snake.GetType();
            // Use System.Reflection.FieldInfo object to discover the attributes of the field and provide access to its metadata
            // https://learn.microsoft.com/en-us/dotnet/api/system.reflection.fieldinfo?view=net-7.0
            FieldInfo ateField = snakeType.GetField("ate", flags);
            // Set the value of the "ate" field within our game's Snake object to true
            ateField.SetValue(snake, true);
        }
    }
}
```

Great, now every time you click your button in game, it will set `ate` to `true` for the next `Move` call. This will grow the tail of your snake! It should look something like this (warning Jamiroquai is playing pretty loud in the background):

<video controls width="800">
    <source src="addtail.webm" type="video/webm">
</video>

Well done! You have hacked your first Unity game.

While I have you though I may as well show you how to call functions as well. There is a `System.Reflection.MethodInfo` function that works similarly to `FieldInfo`. You can then call the MethodInfo object's `Invoke` method for a given object and any arguments it needs. In this case there are no arguments so we just pass `null`.

```
// MethodInfo/GetMethod is pretty much the same as FieldInfo/GetField for targeting methods in instantiated objects
MethodInfo dynMethod = snakeType.GetMethod("Move", flags);
// Call the "Move" method in our Snake object with no arguments
dynMethod.Invoke(snake, null);
```

You can now use this knowledge to play around with other Unity games, like modifying MTGA to let you open up the developer menu (don't worry MTGA is server-side authoritative so theres no cheating here).


![MTGA](mtga.png)


I hope you had fun! If anything doesn't work you can always check out the materials on GitHub [HERE](https://github.com/MayerDaniel/UnityHacking/tree/main/101)
