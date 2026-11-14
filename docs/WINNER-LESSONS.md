# Learning from previous global winners

Four public repositories were inspected on 2026-11-14, with award status checked against the official Space Apps lists. We read source and history without installing or executing these applications. Architecture observations are bounded to the files inspected. They are not the judges' reasons for selecting a winner.

- **Spacebee, 2023, Best Use of Technology:** [award list](https://www.spaceappschallenge.org/2023/awards/global-winners/), [repository](https://github.com/spacebee-technologies/Moonquakes-SpaceApps2023) at `83ae92660862e10dc6c3820d16eaffae0990e6d5`. Read the catalogue-to-JSON processor, lunar scene, entry page and integration files. Transfer: expose the offline data pipeline and source trail, not just a visualization.
- **42 QuakeHeroes, Brazil, 2024, Best Use of Technology:** [award list](https://www.spaceappschallenge.org/nasa-space-apps-2024/awards/global-winners/), [interface repository](https://github.com/gabrielchayb/42-quake-heroes) at `b4c3ba7198a586789a47e3fac34d5479370d0cf0`. Read Flask routes, result template and README; the separately researched notebook contains model training/validation. Transfer: a guided introduction can coexist with direct access to technical evidence. Do not confuse interface code with the model implementation.
- **Connected Earth Museum, 2024, Art & Technology:** [same official 2024 list](https://www.spaceappschallenge.org/nasa-space-apps-2024/awards/global-winners/), [repository](https://github.com/connected-earth/connected-earth-museum). Inspected `e2fc8e0b509e64d68ffc364c2b42d606d88a139f`, the last observed competition-window commit, separately from the 2025 rewrite. Its camera-stop data and preprocessed environmental layers demonstrate a guided route into data. The exact submitted/judged commit is unknown; later files cannot be attributed to the awarded version.
- **PureFlow, Brazil, 2025, Best Mission Concept:** [award list](https://www.spaceappschallenge.org/2025/awards/global-winners/), [repository](https://github.com/larasdiniz/PureFlow-2025) at `df234861e4710bf463595396f4c85b8b58574a89`. Read the designer's analysis loop and technical feedback. Transfer: show a decision's numerical consequences beside the action, rather than hiding them in documentation.

## Implemented lessons

The three-minute Review screen connects a question, live comparison and executed evidence without locking navigation. Compare now shows observed darkness against an editable example limit, preserving lower-bound uncertainty with text and an open-ended bar. Each metric links to its own explanation. A downloadable JSON records the settings, summaries, UTC windows, limitations, source provenance, derived-data checksums and build identity. The same calculation function serves the table, Review and export.

The simulator's mobile imagery is downsampled from the credited sources with recorded conversion hashes; desktop keeps the larger textures. GPU textures are uploaded over separate frames, shaders compile asynchronously, and globe geometry is prepared in a worker. These changes were motivated by measured startup blocking, not by copying another project's implementation.

## Boundaries

No competitor code or assets were incorporated. No root licence was found in the competition-era revisions inspected; learning architecture and interaction principles does not grant code-reuse rights. Current upstream licences may differ. We do not claim external numerical reference validation is absent from entire teams' work merely because it was not found in the bounded source inspection.

The project is a research simulator, not a game, flight tool or guarantee of an award. Actual release checks and their remaining gaps belong in [VERIFICATION.md](VERIFICATION.md). A release-candidate tag identifies a verified source snapshot; a submission tag should be created only when the human actually submits that version.

The detailed research log is retained privately in the existing task TXT. It contains observed files, commit history, gaps and explicitly labelled suggestions; it is not published as a chat dump.
