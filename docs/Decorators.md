
Problem
=======

There are times when we need to "impose" constraints and circumstances 
(eg random errors, acts of gods, queueing, duplications etc) on an actor.  
There are two ways to do this right now:

1. Feature extension - Have every actor implement the specific behaviour.
2. Actor fronting - Create another actor that models the particular behavior
   and manually add it before or after an actor.


With (1) is very simple as we can simply put all these behaviours in a base 
class and it comes for free to each child.  However it is really wierd that 
we want an actor to aware of outcomes/behaviours it has nothing to do with.  
Why should an actor even know/care about a failure rate?  Though hard disks 
fail all the time a Disk actor should not have to model its own failure rate.

The second makes logical sense because external factors (like error rates)
can be easily modelled with custom actors that may apply these outcomes.
However from a modelling perspective this becomes a pain for the system 
modeller.   This is very similar to having every developer who wants to 
time a function either manually calls times before and after the call 
or for each interested function creates custom timer "wrapper" functions.
Also our system diagram with these custom blocks would start looking 
messy with all these extra aspects that clutter the drawings.  ie we wouldnt
want our call tree to show these wrappers.

Goal
====

What we want is to "decorate" actors with other actors.  When an actor receives
a message it should behave as if the message has passed through (and transformed by)
its decorator chain.  Something like:

System X:
  Actor A (calls B)
  Actor B


we may want to introduce a queue or rate limiter or an error injector before B
so we can model delays and errors etc.

We want to describe this with something like:

System X:
  Actor A (calls B)
  @queue
  @errorRate(20%)
  @rateLimit(50qps)
  Actor B
  
A and B should not have any visibility of these decorators.  The world definitely 
knows about it and would have to orchestrate these as it sees fit.


Issues:

Where do we store these decorators?

1. As part of the world.
2. As part of the actor itself (ie in B)
3. As part of the system in which B resides

By being part of the world the world has to do a fair bit of work in managing decorators etc

With decorators belonging to either the actor or its parent system, this means the actors
now have awareness of the decorators (even if they wont do much with it).  

Note that decorators should only be syntactic sugar as much as possible.  It should not affect
things like ordering and so on.  

If decorators were part of the Block - every block would have to be responsible for channeling
the messages to decorators - and worse a Block would have to be the parent of a decorator
but actors can only have Systems as parents.

With decorators being part of the parent System - we would need the System to do some serious
routing of messages and do book keeping.  Technically even for a System this does not make sense
as a System wont know about environmental conditions any more than the actor world (this is
afterall a World responsibility).

Note that this does not mean a Block cannot have its own actors - like Queues and Mailboxes
to change ordering and delay semantics.  The decorator proposal just means for an actor
that doesnt care about this - it shouldnt be forced to host and schedule decorators.
