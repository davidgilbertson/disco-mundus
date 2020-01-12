A memory-training app, on a map.

https://discomundus.web.app

Currently, this only has data for Sydney suburbs. Coming soon (maybe): countries
of the world

PRs are welcome if you have the GeoJSON. Open an issue to discuss.

# Spaced repetition algorithm

I considered copying something like
[SM-2](http://super-memory.com/english/ol/sm2.htm), but did not.

My implementation is (I think) better suited to these strictly-geographical
questions where distance plays an important role. Also, there is less variation
in ease-of-recall between different questions, compared to the questions in a
general purpose memory app, so the 'Easiness Factor' that SM-2 uses would be of
less benefit.

## The Disco Mundus algorithm

### Short version

It doubles the interval for correct answers and allows for partial correctness.

### Long version

First, a score between 0 and 100% is generated for the user's answer.

- If they were correct, let the score be 100%; else
- If the feature they tapped is adjacent to the correct feature, let the score
  be 80%; else
- The distance between the tapped place and the center of the correct feature is
  used to grade the score:
  - Between 0 and 4KM, grade the score from 100 down to 0%.
  - x KM or more away, let the score be 0%

The score is then converted to a multiplier between 0 and 2.

The time since the last review (or 10 minutes, if this is the first review) is
then multiplied by the multiplier, and used to set the next review time.

There is a minimum review interval of 1 minute.

Answering incorrectly essentially 'resets' a question, since the multiplier is
0, it will revert back to 1 minute.

### Session queue

At all times, questions are asked from a queue. This is a subset of the total
set of questions. All questions in the session queue are presented for review
before any new questions are asked. When the page is first loaded, any questions
ready for review are put in the session queue. Once all of these questions have
been reviewed sufficiently (and the session queue is empty) 10 new questions
will be picked to populate the session queue (to be configurable in the future).

A question may be presented several times, based on the next review date and the
lookahead window. For example: a user is reviewing their questions, and answer
one incorrectly. The 'next review time' is set to one minute. Because one minute
is less than the 'lookahead window' of 10 minutes, it is kept in the queue so
that it can be reviewed again before moving on to new questions. Specifically, a
question answered incorrectly once must be answered correctly twice before it's
removed from the session queue.

If a question is answered correctly on the first attempt, its next ask date will
be 20 minutes in the future, which falls outside the lookahead window, and so it
will be removed from the session queue immediately, avoiding unnecessary
repetitions.

### Variables

- **Multiplier:** for a correct answer, how much will the previous interval be
  multiplied by to get the next interval.
- **First review time:** when a question is first answered, what should the
  review time be for a correct answer.
- **Minimum review time:** If a question is answered incorrectly (has a score of
  0%), the next review should not be set to 0 minutes. Instead, this minimum
  should be enforced.
- **Lookahead window:** when selecting the next question, how far into the
  future should we look. E.g. if lookahead window is 10 minutes, and there is a
  question due for review in 5 minutes, then the system would ask that question,
  before removing it from the queue and moving on to new questions.

### A weak spot

A user may know and answer very well, and the last duration was a few months,
but they bump the screen and get the answer wrong. The question gets reset, but
really it will only be five or six extra reviews to get it back up again.

## Ongoing review

The results will be monitored. The goal is that 90% of answers are correct or
very close (score > 80%) when using the app daily - dependent on how many new
questions are being asked.

For the well-remembered questions, there would be ~4 revisions in the first
week, 2 more for the rest of the month, another 4 for the rest of the year, and
so on.

Running `printStats()` in the console will print stats. Also clicking on my
house will show them as a popup :)

The scaling of the score is currently hardcoded as 4KM, as the app only shows
Sydney suburbs and this scale works fine. Eventually, I'll want something more
sophisticated like the distance between two points as a ratio of the diameter of
the target feature.
