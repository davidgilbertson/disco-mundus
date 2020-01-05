A memory-training app, on a map.

https://discomundus.web.app

Currently, this only has data for Sydney suburbs. Coming soon (maybe): countries of the world

PRs are welcome if you have the GeoJSON. Open an issue to discuss.

# Spaced repetition algorithm

I considered copying something like [SM-2](http://super-memory.com/english/ol/sm2.htm), but did not.

My implementation is (I think) better suited to these
strictly-geographical questions where distance plays an important role. Also, there is less variation in
ease-of-recall between different questions, compared to the questions in a general purpose memory app,
so the 'Easiness Factor' that SM-2 uses would be of less benefit.

## The Disco Mundus algorithm

### Short version

It doubles the interval for correct answers, divides by ten for wrong answers, and allows for partial correctness.

### Long version

First, a score between 0 and 1 is generated for the user's answer.
 * If they were correct, let the score be 1; else
 * If the feature they tapped is adjacent to the correct feature, let the score be 0.8; else
 * The distance between the tapped place and the center of the correct feature is used to grade the score:
   * Between 0 and x KM, grade the score from 1 down to 0.
   * x KM or more away, let the score be 0

The score is then converted to a multiplier between 0.1 and 2.

The time since the last review (or 10 minutes, if this is the first review) is then multiplied
 by the multiplier, and used to set the next review time.

There is a minimum review interval of 1 minute.

For example, if it's been 10 days since a user last answered a question (meaning they had probably got
 it right several times in a row), then if:
 * they get it wrong (score 0): we will ask in 1 day
 * they are close (score 0.5): we will ask in another 10
 * they get it right (score 1): we will ask again in 20 days

### A weak spot

There is a potential weak spot here: the scenario where the user doesn't use the app for weeks or months
when they have quite young questions. They may have only answered a question once, and completely forgotten it,
but if it's 20 days since they used the app, a wrong answer will still put the review at 2 days ahead. It would then
take a few days of answering question incorrectly (each time multiplying the previous interval by 0.1) for them
to be treated the same as the SM-2 algorithm would (which is treating a wrong answer as though the question had
never been seen).

## Ongoing review

The results will be monitored. The goal is that 90% of answers are correct or very close (score > 0.8) when using
the app daily.

For the well-remembered questions, there would be ~4 revisions in the first week, 2 more for the rest of the
month, another 4 for the rest of the year, and so on.

Running `printStats()` in the console will print stats. Also clicking on my house will show them as a popup :)

The scaling of the score is currently hardcoded as 5 KM, as the app only shows Sydney suburbs and this scale works fine.
Eventually, I'll want something more sophisticated like the distance between two points as a ratio of the diameter
of the target feature.
