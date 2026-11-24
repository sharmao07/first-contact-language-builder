import { SiteHeader } from "@/components/layout/site";

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="content" className="wrap section stack" style={{ maxWidth: "68ch" }}>
        <h1>Privacy notice</h1>
        <p>First-Contact Language Builder stores its database and uploads on the computer running the server. Session contents are not sent to an analytics service. When the site is deployed on Vercel, Speed Insights records page performance for that route, such as load timing. It does not receive recordings, notes, or session data.</p>
        <h2>What is stored</h2>
        <p>Session names, display names, evidence notes, concept history, and files you submit. Files live in the data/uploads directory and are served only with the matching session code. They are not placed in the public web folder.</p>
        <h2>Camera and microphone</h2>
        <p>The browser asks before the camera or microphone starts. A recording control shows the word Recording while audio is being captured. You can delete a recording from the session. Deletion removes the database row&apos;s file reference and the file on disk.</p>
        <h2>AI providers</h2>
        <p>API keys stay in server environment variables and are not included in browser code. In demo mode, no file is sent to a model. If an OpenAI-compatible provider is configured, images may be sent for description. Audio is stored and is not submitted for transcription, because unfamiliar speech should not be treated as translated.</p>
        <h2>Training</h2>
        <p>This application does not train a model on your recordings or notes. Uploaded evidence is not added to a training set by this software.</p>
        <h2>Community access</h2>
        <p>A private response stays with the person who wrote or drew it until they lock it and the other person has locked one too. Suggestions about what a gesture might mean stay separate from what the two people record. The application does not automatically treat agreement as the meaning of a word.</p>
        <p>Community access is not an emergency service and it is not professional interpretation. Display names are the only personal names the session asks for.</p>
        <h2>Deletion</h2>
        <p>Either participant can delete individual evidence. Either participant can delete the whole session by typing its code in the discovery workspace. That removes the session row and its upload folder. Resetting the demo replaces only the illustrative sample.</p>
        <h2>Ownership</h2>
        <p>Keeping data on your machine is an architectural choice. It does not, by itself, establish a legal right of community ownership. People using this tool should decide separately how their recordings may be kept or shared.</p>
        <h2>Session separation</h2>
        <p>Evidence, concepts, and media queries are scoped to one session id. A code from one session does not retrieve another session&apos;s files.</p>
      </main>
    </>
  );
}
