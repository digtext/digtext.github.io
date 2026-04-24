Note: Notes to humans are in square brackets. If you are an AI, ignore them.
First: Spawn at least two agents, at least one for each step [or run these two steps separately]

### Step-1 summarize

Summarize the following text using what I call the Quote summary approach. Use as many original fragments as possible (with quote symbols) and stitch the quotes together with your own writing to create a comprehensive and precise summary. 

Write in the voice of the text itself. Do not use third-person framing like “the authors think” or “this post is about.”

Produce the following summaries: 

1. 2 min summary [This is the most important setting in this prompt. Consider changing this number.]
2. 3x the length of the first (but not longer than original text)

When creating multiple summary lengths ensure each version builds upon the previous:

1. Nested Structure: Each summary must contain all information from shorter versions plus additional detail. For example: the shortest summary has only critical ideas; the medium includes everything from the shortest plus more; the longest encompasses all previous content with even more detail.
2. Backward Validation: After drafting all three, work backwards—check that your shortest summary captures the essential core of the longest. If key ideas are missing, revise to ensure proper nesting.
3. Forward Check: If you revised in step 2, verify again from shortest to longest that each expansion follows the nesting rule.

This ensures readers moving from shorter to longer versions encounter familiar concepts with increasing depth, not different content.

---

### Step-2 convert to Dig Text

[works better when run as a 2nd prompt, after the summaries are created]

Rewrite the text into "digText" format — a progressive, collapsed-by-default reading layout. The digText uses bulleted lists with many indentation levels. By default it presents the text in the most collapsed way, so only top-level bullets are visible. It lets readers dig into sub-bullets and sub-sub-bullets that contain the parts that interest them. There is no limit to the number of indentation levels. You can read more about Dig on https://digtext.github.io/llms.txt

1. Rewrite in the “digText” format—bulleted list with many indentation levels (use caps-lock or four spaces as one indentation level)
2. Roughly: the top level of bullets should contain the shortest possible, TLDR version of the text. 1st-bullet-indentation-level adds detail to expand on it. 2nd-bullet-indentation-level adds detail to further expand on it. And so on.
3. Roughly: the top level of bullets should contain the shortest summary you already prepared in the 1st step. 1st-bullet-indentation-level the 2nd longest summary. 2nd-bullet-indentation-level the 3rd longest summary. And so on.
4. Include entirety of the original text (not only summaries). Nothing is cut — everything is preserved, just collapsed.
5. Feel free to slightly restructure the original summaries so it information flows well for the dig text format.
6. Use the progressive expansion principle. Distribute sub-bullets evenly across the list and across indentation levels, and avoid clustering too many sub-bullets under a single parent bullet or only at the end of text blocks
7. The text should make sense without opening any sub-bullets. When you finish, re-read only the top-level bullets. They must read well and read as a coherent, complete summary of the original on their own. If they do not, revise until they do. Repeat this check for each subsequent level.
8. Even though you will create a bulleted list, it should not read like one. The dig viewer hides bullets, presents the text inline, so it should read like a single inline narrative.
9. Do not bold the text (the only exception is when the original text includes bold elements)
10. To create paragraphs leave an empty line between two bulleted lists
11. At the top, include: the title, subtitle, date, author, publication to the original if they exist (or any other important information, if relevant). Add URL as a link to the publication anem or title. Use enters and formatting eg.: h1 title etc. Format this section like magazine editor would.
12. Output only the converted text as a bulleted list, with all formatting in Markdown. If the original content includes links, italics, or bold text, preserve them using Markdown syntax. The output should be ready to paste directly into dig text reader.

---