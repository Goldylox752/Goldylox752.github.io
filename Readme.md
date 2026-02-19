⚡ BrandGIF | Asset Engine
A high-performance, Neobrutalist search engine for branded Giphy assets. This project is built with a "zero-dependency" philosophy, utilizing native browser APIs and the latest utility-first styling engines.
🛠 Tech Stack
1. HTML5 (Semantic Structure)
Role: The skeleton of the engine.
Key Features: Uses semantic tags (<header>, <main>, <section>) for SEO and accessibility. It manages the viewport for a responsive, "mobile-first" experience.
2. CSS3 & Tailwind CSS 4.0 (Design Engine)
Role: Visual identity and layout.
Implementation:
Tailwind 4.0: Leverages the new high-performance engine for rapid styling via utility classes.
Custom @theme: Extends the design system with "Brutal" variables (e.g., --shadow-brutal).
Advanced CSS: Includes custom scrollbar styling and complex hover transitions (transform: translate) to achieve the Neobrutalist aesthetic.
3. JavaScript (ES6+ Logic)
Role: Powering the "Engine" and API interaction.
Key Features:
Asynchronous Fetch: Uses async/await to pull real-time data from the Giphy API.
Infinite Scroll: A custom-built scroll listener that triggers data fetching as the user nears the bottom of the page.
DOM Manipulation: Dynamically injects asset cards into the grid using template literals.
Clipboard API: Uses navigator.clipboard for a seamless "one-click" link-sharing experience.
🚀 Key Functionalities
Dual Mode: Toggle instantly between Gifs and Stickers via state management.
Dynamic Search: Real-time query updates with an "Enter" key listener.
Visual Feedback: Randomised "Loading Vibes" messages to enhance the user experience during data fetching.
Brutal UI: Heavy borders, high-contrast yellow/black palette, and 2D "hard" shadows.
📦 Local Setup
Clone the repository.
Replace API_KEY in the script with your Giphy Developer Key.
Open index.html in any modern browser. No build step required!
Built for speed. Built for brands. Built with BrandGIF.
