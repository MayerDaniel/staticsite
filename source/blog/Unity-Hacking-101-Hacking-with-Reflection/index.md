# Unity Hacking 101: Hacking with Reflection

_This tutorial is for Windows machines. Associated materials can be found on GitHub [HERE](https://github.com/MayerDaniel/UnityHacking)_

I recently participated in the [Global Game Jam](https://globalgamejam.org/), spending 48 hours creating a game in Unity with a very talented team comprised of game industry professionals and a few novices like me. My contributions were modest and filled with spaghetti but with the help of the great game programmers on my team, I got a much better understanding of the basics of how the engine works. 

Unity is written in C#, which also allows us to make use of [Reflection](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/concepts/reflection), a very powerful tool set built into C# which allows for the introspection and manipulation of running processes - we will talk more about this further down. 

C# also decompiles incredibly cleanly, making Unity games a great place to start as well if you are interested in reverse engineering. To get a handle on the basics of Unity though, let's first do some plain ol' forward engineering.

## Snake: A Unity Primer

To get a basic understanding of how the engine works, I recommend you follow this tutorial to make a very basic snake game:

[Unity 2D Snake Tutorial](https://noobtuts.com/unity/2d-snake-game)

This will get you acquainted with the basic concepts of GameObjects and how C# scripting works within the engine to construct the game logic. 

If you don't want to walk through it though, I have included my build of the game on GitHub [HERE](https://github.com/MayerDaniel/UnityHacking/blob/main/101/snakebuild.zip?raw=true) (clicking this will download the zip file). The only difference between my build and the tutorial is I added the following line to reload the scene when you die:

```cs
SceneManager.LoadScene(SceneManager.GetActiveScene().name);
```

## DNSpy: A first foray into reverse engineering

For this part, we will need to download a .NET decompiler. This will allow us to look at our built snake game to get an idea of what Unity games look like when they are shipped. I recommend DNSpy since it also allows for debugging .NET assemblies relatively easily. It can be found [HERE](https://github.com/dnSpyEx/dnSpy)

If you followed the tutorial, first build your game to a known location. Otherwise, unzip my included build to a known location. Navigate there and find the file located at `.\snake_Data\Managed\Assembly-CSharp.dll`. For most games, this is the file that holds most of the game logic written by the game designers.