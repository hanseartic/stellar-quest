# Solving the stellar-quests in code
This repository contains solutions and approaches to all the quests in [stellar-quest](https://quest.stellar.org).

The solutions will be structured in sub-folders by SDK/language.

## Solving a quest
Within the SDKs' sub-folders there are sub-folders per set with a module/class per quest.
The quest can be invoked directly and will read the quest key either from an environment variable
or from `stdin` (e.g. `…/stellar-quest/JS> node Set1/SQ0101`).

## Verifying a quest
The JS solutions also have verification for the quests. Just run `node run verify` inside the JS
folder and a webserver on port 4321 will be started waiting to verify a quest for a given account.

A quest is then verified by making a request to localhost:4321/verify/QUEST/account e.g.

    curl http://localhost:4321/verify/SQ0101/GJL4K...JHU24Q

