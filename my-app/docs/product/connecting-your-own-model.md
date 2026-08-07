# Connecting your own AI model

For organizations that want analysis to run on a model they control rather than
on OpenAI.

## How it works, briefly

Your model runs on your computer. Our servers cannot reach it — nothing on the
internet can reach a program running on your own machine, which is the point.
So your **browser** does the work instead: it fetches the prompt from us, sends
it to your model, and sends the answer back.

Two consequences follow from that, and both surprise people:

- **A browser tab has to stay open.** Analysis for your organization only
  progresses while someone has the application open with their model connected.
  Close every tab and it pauses; reopen one and it resumes where it stopped.
- **You have to give your model permission to talk to our website.** Model
  servers refuse web pages by default, because otherwise any site you visited
  could quietly use your computer's AI. You are allowing ours specifically.

  Ollama makes an exception for pages served from your own machine, so if you
  are running the application locally there is nothing to configure. The
  permission step only applies to the hosted application.

## What you need

- A model server exposing an **OpenAI-compatible API** — Ollama, LM Studio,
  vLLM, llama.cpp, LocalAI and others all do.
- A **generation model** that supports JSON schema output. The connection test
  checks this and will refuse a model that does not; see below for why.
- An **embedding model**. Any size works — there is no dimension requirement.

## Setup

### Ollama, installed normally

```powershell
# Windows
winget install Ollama.Ollama
ollama pull gemma3:27b
ollama pull embeddinggemma
```

```bash
# macOS / Linux
brew install ollama            # or from ollama.com/download
ollama pull gemma3:27b
ollama pull embeddinggemma
```

That is the whole setup if you are running the application on your own machine:
Ollama already accepts pages served from `localhost` and `127.0.0.1`, on any
port. Verified against Ollama's preflight response, which returns
`Access-Control-Allow-Origin: http://localhost:3000` with nothing configured.

**For the hosted application**, its domain has to be allowed explicitly —
without it Ollama answers the browser's preflight with `403` and the request
never happens:

```powershell
# Windows
setx OLLAMA_ORIGINS "https://your-app-domain"
```

```bash
# macOS
launchctl setenv OLLAMA_ORIGINS "https://your-app-domain"
```

**Then restart Ollama, and mind how.** The value is read once at startup, and a
restart only picks it up if the environment it starts from has the new value.
Setting the variable and restarting from a terminal you already had open will
silently keep the old (empty) value — the setting looks applied but nothing
changed. Quit Ollama from the system tray and start it again from a *new*
terminal, or log out and back in.

**Never use `*` as the origin.** That would let any website you visit call
your local model server from your browser and run your models. Allow only the
exact application domain, and keep the server bound to `127.0.0.1` so it is
not reachable from your local network.

### Ollama in Docker

Easier than the native install, because the setting is just a flag:

```bash
docker run -d --name ollama \
  -e OLLAMA_ORIGINS="https://your-app-domain" \
  -p 127.0.0.1:11434:11434 \
  -v ollama:/root/.ollama \
  ollama/ollama

docker exec ollama ollama pull gemma3:27b
docker exec ollama ollama pull embeddinggemma
```

The `-p 127.0.0.1:11434:11434` part matters. Your browser runs on your machine,
not inside the container, so the container's port has to be published to your
machine for the browser to reach it. Binding to `127.0.0.1` rather than all
interfaces keeps it off your local network.

Enter `http://127.0.0.1:11434/v1` as the model URL, exactly as for a native
install — from the browser's point of view there is no difference.

### Other model servers

The requirement is the same everywhere: the server must accept requests from
our origin. Only the setting's name changes.

| Server | How to allow the origin |
| --- | --- |
| Ollama | `OLLAMA_ORIGINS` environment variable |
| LM Studio | "Enable CORS" toggle in the local server settings |
| vLLM | `--allowed-origins` on the OpenAI-compatible server |
| llama.cpp server | Permissive by default; no setting needed |
| LocalAI | `CORS` and `CORS_ALLOW_ORIGINS` environment variables |

Whatever the server, enter the base URL of its OpenAI-compatible API — usually
ending in `/v1`.

### A model on another machine

Supported, but with one extra requirement. Browsers make an exception for
`localhost` and let a secure page talk to it; they do not extend that to other
addresses. So a model at `http://192.168.1.50:11434` will be blocked as
insecure content.

Either serve that machine over HTTPS, or forward its port to your own machine so
it looks local:

```bash
ssh -N -L 11434:localhost:11434 user@192.168.1.50
```

Then connect to `http://127.0.0.1:11434/v1` as usual.

## Connecting

1. Open your organization's settings and set the AI provider to self-hosted.
2. Enter the model server URL and the two model names.
3. Click **Test connection**.

The test reports four things:

- **Server reachable.** If this fails it tells you which problem you have: a
  server that is running but refusing this site, or nothing listening at all.
  They look identical in a browser but need opposite fixes.
- **Honours JSON schemas.** The important one. A model that ignores the schema
  does not fail loudly — it returns perfectly valid JSON with field names it
  invented, which only breaks much later and looks like a bug in the analysis.
  A model that fails this check cannot be saved.
- **Embedding size.** Recorded so your documents can be indexed correctly.
- **Context window.** Read from the loaded model rather than its advertised
  maximum, which is usually much larger and misleading.

Then click **Save and connect**. The relay keeps running as long as the app is
open in this tab - navigating to other pages or refreshing the page does not
disconnect it. Closing the tab pauses the analysis until someone opens the
application again.

## Changing models later

- **Changing the generation model is free.** Swap it whenever you like.
- **Changing the embedding model re-indexes every document.** Your documents
  were converted into numbers by that specific model, and numbers from two
  different models cannot be compared. Existing searches keep working on the old
  index until the rebuild finishes, and the rebuild also runs through your
  browser — so it needs the tab open for its whole duration.

## When something goes wrong

**"Nothing is listening at that address."** The server is not running, or the
port is wrong. Check with `ollama list`, or `docker ps` for a container.

**"Running but not allowing requests from this site."** The origin setting is
missing, or the server was restarted in a way that did not pick it up — see the
note about restarting above, which is the usual cause when the setting looks
correct. The panel shows the exact command. This should never appear when
running the application locally.

**Analysis sits at "waiting".** No browser is connected - the screen says
"Waiting for a connected browser". Open the application, connect once, and it
will pick up where it stopped while this tab stays open.

**Analysis is slow.** Expected. A local model is slower than a hosted one, and
most servers answer one request at a time. A full analysis is many requests.

**The connection test says the model ignores JSON schemas.** Pick a different
model. This is not a setting you can override — the analysis depends on
structured answers, and a model that cannot produce them reliably would generate
plausible-looking but wrong results.
