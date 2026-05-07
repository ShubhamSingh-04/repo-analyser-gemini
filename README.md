# GitHub AI Analyzer

An AI-powered GitHub repository analysis tool that helps users understand repositories, analyze codebases, and interact with projects using AI.

---

# Setup Instructions

Before running the project, create an `application.properties` file inside:

```text
src/main/resources/
```

---

# Add the following configuration

```properties
spring.application.name=github-ai-analyzer

gemini.api.key=YOUR_GEMINI_API_KEY
github.pat=YOUR_GITHUB_PAT_CLASSIC
```

---

# Example

```properties
spring.application.name=github-ai-analyzer

gemini.api.key=AIzaSyXXXXXX
github.pat=ghp_xxxxxxxxxxxxxx
```

---

# Important

- Do NOT push your real API keys or PATs to GitHub.
- Make sure `application.properties` is added to `.gitignore`.

Example:

```gitignore
src/main/resources/application.properties
```

---

# Required Credentials

## Gemini API Key

Get your Gemini API key from:

- [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## GitHub Personal Access Token (Classic)

Generate a GitHub PAT (Classic) from:

- [GitHub Developer Settings](https://github.com/settings/tokens)

---

# Developer

**Shubham Singh**

- Email: shubhamsinghmys@gmail.com
- LinkedIn: [Shubham Singh LinkedIn](https://www.linkedin.com/in/shubham-singh-mysore/)