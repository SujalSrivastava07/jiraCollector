# GeneiAI Jira-to-PR Multi-Agent Pipeline

A full-stack MERN application that autonomously acts as a software engineer. It listens for newly created Jira tickets, maps the Jira project to a connected GitHub repository, and orchestrates a pipeline of specialized AI agents to resolve the issue from end to end.

## How It Works

When a Jira ticket is labeled with `genie-ai`, the backend intercepts the webhook and triggers a sophisticated state machine orchestrating multiple agents:

1. **Intake & Understanding**: Parses the raw Jira webhook and extracts technical requirements, assigning an "Ambiguity Score".
2. **Clarification**: If the requirements are too ambiguous, the pipeline halts and generates clarifying questions.
3. **Context Gathering**: Uses Retrieval-Augmented Generation (RAG) to search the mapped GitHub repository for relevant code context.
4. **Planning**: Formulates a step-by-step implementation plan.
5. **Coding**: Generates precise code patches (additions, deletions, modifications).
6. **Validation**: Acts as an automated reviewer, checking for syntax errors or build issues.
7. **Pull Request**: Pushes the code to a new branch and opens a Pull Request on GitHub.

## Tech Stack

- **Frontend**: React 19, Vite, TailwindCSS v4, Framer Motion (for real-time pipeline visualization).
- **Backend**: Node.js, Express.js.
- **Database**: MongoDB (Mongoose) for multi-tenant configurations and project mapping.
- **AI Integrations**: Groq / OpenAI LLMs.
- **APIs**: Jira Webhooks, GitHub API (Octokit).

##  Setup & Installation

### Prerequisites
- Node.js (v18+)
- MongoDB cluster
- GitHub App Credentials & Personal Access Token
- Jira Webhook Secret

### Backend Setup
```bash
cd backend
npm install
# Create a .env file based on .env.example
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

##  Real-Time Observability
The React dashboard actively polls the backend orchestrator, utilizing Framer Motion to visualize the exact stage of the AI pipeline in real-time, providing deep transparency into what the agents are thinking and doing.
