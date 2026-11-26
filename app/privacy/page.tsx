import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/layout/site";
import { PageHeader } from "@/components/ui/bits";

const SECTIONS = [
  [
    "What is stored",
    "Session names, display names, evidence notes, concept history, and files you submit. Files live in the data/uploads directory and are served only with the matching session code. They are not placed in the public web folder.",
  ],
  [
    "Camera and microphone",
    "The browser asks before the camera or microphone starts. A recording control shows the word Recording while audio is being captured. You can delete a recording from the session. Deletion removes the database row's file reference and the file on disk.",
  ],
  [
    "AI providers",
    "API keys stay in server environment variables and are not included in browser code. In demo mode, no file is sent to a model. If an OpenAI-compatible provider is configured, images may be sent for description. Audio is stored and is not submitted for transcription, because unfamiliar speech should not be treated as translated.",
  ],
  [
    "Training",
    "This application does not train a model on your recordings or notes. Uploaded evidence is not added to a training set by this software.",
  ],
  [
    "Community access",
    "A private response stays with the person who wrote or drew it until they lock it and the other person has locked one too. Suggestions about what a gesture might mean stay separate from what the two people record. The application does not automatically treat agreement as the meaning of a word. Community access is not an emergency service and it is not professional interpretation. Display names are the only personal names the session asks for.",
  ],
  [
    "Deletion",
    "Either participant can delete individual evidence. Either participant can delete the whole session by typing its code in the discovery workspace. That removes the session row and its upload folder. Resetting the demo replaces only the illustrative sample.",
  ],
  [
    "Ownership",
    "Keeping data on your machine is an architectural choice. It does not, by itself, establish a legal right of community ownership. People using this tool should decide separately how their recordings may be kept or shared.",
  ],
  [
    "Session separation",
    "Evidence, concepts, and media queries are scoped to one session id. A code from one session does not retrieve another session's files.",
  ],
] as const;

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="content" className="wrap-narrow page-pad stack-lg">
        <PageHeader
          eyebrow="Data handling & boundaries"
          title="Privacy notice"
          description="First-Contact Language Builder stores its database and uploads on the computer running the server. Session contents are not sent to an analytics service. When deployed on Vercel, Speed Insights records route load timing only and never receives recordings, notes, or session data."
          actions={<Link className="btn btn-sm" href="/settings">Settings</Link>}
        />
        <div className="stack">
          {SECTIONS.map(([heading, body]) => (
            <section key={heading} className="surface stack-xs">
              <h2>{heading}</h2>
              <p className="small" style={{ color: "var(--ink)", lineHeight: "22px" }}>{body}</p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
