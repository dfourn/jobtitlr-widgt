# Brief: Feefo Software Engineering Full-stack Technical Assessment 2026

Original: `feefo-assessment-2026.pdf`. The design image extracted from it is `widget-reference.png` (401x443 px).
Below is a transcription of the key requirements, so specs and tests can refer to them by ID.

## General
- Two-part assessment. If we pass, there is an interview, so be ready to answer technical questions about the submission.

## Part 1: OOP (Java), "Standardizing Job Titles Process"
- **B1.1** Given a list of ideal (normalised) job titles, write a class that returns the best match for an input string.
- **B1.2** Default list: "Architect", "Software engineer", "Quantity surveyor", "Accountant".
- **B1.3** Examples: Java engineer -> Software engineer; C# engineer -> Software engineer; Accountant -> Accountant; Chief Accountant -> Accountant.
- **B1.4** Hint: internally, use a quality score q with 0.0 <= q <= 1.0 to find the closest match.
- **B1.5** Sample code: `Normaliser n = new Normaliser(); String normalisedTitle = n.normalise(jt);`
- **B1.6** Deliver a runnable, testable project (public GitHub repo or zip) that can be imported into an IDE. Include testing descriptions or evidence.
- **B1.7** They are looking for: **good project structure, evidence of good OOP principles, defensive coding, unit testing.**

## Part 2: UI (React + TypeScript), product rating widget
- **B2.1** Implement the design in the screenshot: "EXCELLENT", 5 stars with 4.6 filled, "4.6 OUT OF 5", "Product Rating" with the feefo logo, and a breakdown bar for each star rating (5:952, 4:171, 3:55, 2:14, 1:40).
- They would like to see:
  - **B2.2** The design reproduced accurately
  - **B2.3** A layout that grows and shrinks sensibly with the viewport
  - **B2.4** Sensible component boundaries and separation of responsibilities
  - **B2.5** TypeScript for props and data structures
  - **B2.6** Clean, readable, maintainable code
  - **B2.7** Semantic HTML and accessibility throughout
  - **B2.8** ARIA attributes where they add value
  - **B2.9** Automated tests covering important component behaviour **and user interactions**
- Technical notes:
  - **B2.10** React and TypeScript.
  - **B2.11** Font: Google Font Poppins. Exact sizes don't need to be pixel-perfect.
  - **B2.12** Free choice of styling approach. **They are interested in the reasoning** behind the choice.
  - **B2.13** Vitest or Jest with Testing Library, or an equivalent.
  - **B2.14** Extra libraries are allowed, but be ready to explain why.
  - **B2.15** Must run locally by following the README.
  - **B2.16** Share it in the GitHub repository.
- **B2.17** "We are interested in **how you approach the implementation**, not simply whether every pixel matches." They will judge component design, TypeScript modelling, responsiveness, accessibility, testing and maintainability.

## Measured from the reference image (Python/PIL)
- **Colours**:
  - star and bar yellow `#ffcb31`
  - bar track `#e2e2e2`
  - empty star part `#d4d4d4`
  - dark text about `#25292f` / `#3f3c3d`
  - muted text about `#646c76`
- **Data**: total = 952+171+55+14+40 = **1232**. Weighted mean = 5677/1232 = **4.608, shown as 4.6**, so the data is internally consistent.
- **Bar widths are each rating's share of the total, not of the largest count.** The 952 bar fills about 77% of the track, and 952/1232 = 77.3%. The 171 bar fills about 13.6%, and 171/1232 = 13.9%.
- **The 5th star is about 60% filled**, so it is a partial fill proportional to the score, not a rounded half star.
- **The card** is a 360x405 box at (20, 16) in the 401x443 image: a 1px border `#d4d4d4` at x 20-379 and y 16-420, white outside it. The harness compares the widget with this crop (spec 03, section 3).
