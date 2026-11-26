"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Eraser, FileText, Hand, ImageIcon, Mic, Pencil, PersonStanding, Square, Trash2, Upload, Video } from "lucide-react";
import { Field, Notice } from "@/components/ui/bits";
import { PreviewFrame } from "@/components/ui/media";
import { MotionSwap } from "@/components/ui/motion";
import { api, ApiError } from "@/lib/client/api";
import { ACTION_CATEGORIES, CATEGORY_LABEL } from "@/lib/constants";
import type { ConceptDTO } from "@/lib/types";

const modes = [
  ["camera", "Camera", Camera],
  ["image", "Image", ImageIcon],
  ["drawing", "Drawing", Pencil],
  ["audio", "Audio", Mic],
  ["video", "Video", Video],
  ["gesture", "Gesture", Hand],
  ["demonstration", "Demonstration", PersonStanding],
  ["note", "Written note", FileText],
] as const;

type Mode = (typeof modes)[number][0];

export function Composer({
  code,
  token,
  concepts,
  purpose,
  onDone,
}: {
  code: string;
  token: string;
  concepts: ConceptDTO[];
  purpose?: string;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<Mode>("image");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [actionCategory, setActionCategory] = useState<string>("pointing");
  const [conceptId, setConceptId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [stance, setStance] = useState("observation");
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [gestureDirection, setGestureDirection] = useState("toward an object");
  const [gestureRepetition, setGestureRepetition] = useState("once");
  const [gestureBody, setGestureBody] = useState("");

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function takeFile(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next && next.type.startsWith("image/") ? URL.createObjectURL(next) : next ? "file" : null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    if (mode === "note" && !description.trim()) {
      setMessage("Write what was expressed before submitting the note.");
      setPending(false);
      return;
    }
    if (mode === "video" && !file) {
      setMessage("Attach a video, or describe a demonstration instead.");
      setPending(false);
      return;
    }
    const type = mode === "camera" ? "image" : mode === "demonstration" ? "gesture" : mode;
    const form = new FormData();
    form.set("type", type);
    form.set("description", description);
    form.set("notes", notes);
    form.set("actionCategory", mode === "gesture" || mode === "demonstration" || mode === "camera" ? actionCategory : "");
    form.set("conceptId", conceptId);
    form.set("stance", stance);
    form.set("consentToAnalyze", consent ? "yes" : "no");
    form.set("durationMs", durationMs ? String(Math.round(durationMs)) : "");
    form.set("qualityNote", durationMs ? "Duration was read in the browser. It is not an acoustic analysis." : "");
    form.set("gestureDirection", mode === "gesture" || mode === "demonstration" ? gestureDirection : "");
    form.set("gestureRepetition", mode === "gesture" || mode === "demonstration" ? gestureRepetition : "");
    form.set("gestureBody", mode === "gesture" || mode === "demonstration" ? gestureBody : "");
    if (file) form.set("file", file, file.name);
    try {
      const saved = await api<{ evidenceId: string }>(`/api/sessions/${code}/evidence`, { token, form });
      if (purpose === "community") {
        setMessage("Evidence saved. Community access does not create hypotheses from this upload. Respond on the Community page first.");
      } else {
        try {
          await api(`/api/sessions/${code}/analyze`, { token, body: { evidenceId: saved.evidenceId } });
          setMessage("Evidence saved. Hypotheses were added as open suggestions, not as verified meanings.");
        } catch (caught) {
          setMessage(`Evidence saved. Hypotheses were not created: ${caught instanceof ApiError ? caught.message : "the facilitator failed."}`);
        }
      }
      setDescription("");
      setNotes("");
      takeFile(null);
      onDone();
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.message : "The evidence was not saved.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="surface stack" onSubmit={submit}>
      <div className="row-between">
        <h3>Record evidence</h3>
        <span className="small muted">Images 8 MB · Audio 10 MB · Video 25 MB</span>
      </div>

      <div
        className="segment"
        role="tablist"
        aria-label="Evidence type"
        onKeyDown={(event) => {
          const index = modes.findIndex(([id]) => id === mode);
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const next = event.key === "ArrowRight" ? (index + 1) % modes.length : (index - 1 + modes.length) % modes.length;
          setMode(modes[next][0]);
          takeFile(null);
        }}
      >
        {modes.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={mode === id}
            className="btn"
            onClick={() => {
              setMode(id);
              takeFile(null);
            }}
          >
            <Icon size={15} strokeWidth={1.5} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <MotionSwap motionKey={mode} className="surface-recessed stack-sm">
        {mode === "camera" ? <CameraCapture onCapture={takeFile} /> : null}
        {mode === "image" ? <ImageDrop file={file} preview={preview} onFile={takeFile} /> : null}
        {mode === "drawing" ? <DrawingPad onSave={takeFile} /> : null}
        {mode === "audio" ? <AudioCapture file={file} onFile={takeFile} onDuration={setDurationMs} /> : null}
        {mode === "video" ? (
          <Field label="Video file" hint="A short recording of what was shown. The app does not interpret the video by itself.">
            <input className="control" type="file" accept="video/webm,video/mp4,video/quicktime" onChange={(event) => takeFile(event.target.files?.[0] ?? null)} />
          </Field>
        ) : null}
        {mode === "note" ? <p className="small">A written description of what someone expressed. It is an observation, not a translation.</p> : null}
        {mode === "gesture" || mode === "demonstration" ? (
          <GestureFields
            actionCategory={actionCategory}
            onAction={setActionCategory}
            file={file}
            onFile={takeFile}
            direction={gestureDirection}
            repetition={gestureRepetition}
            body={gestureBody}
            onDirection={setGestureDirection}
            onRepetition={setGestureRepetition}
            onBody={setGestureBody}
            onDuration={setDurationMs}
            onFrame={(frame, note) => {
              takeFile(frame);
              setNotes((current) => current || note);
              setConsent(false);
            }}
          />
        ) : null}
      </MotionSwap>

      <Field label="Description">
        <textarea
          className="textarea"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What happened, in your own words?"
        />
      </Field>

      <div className="grid-2">
        <Field label="Context note">
          <input className="control" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Where, when, or who was present" />
        </Field>
        <Field label="What kind of record is this?">
          <select className="select" value={stance} onChange={(event) => setStance(event.target.value)}>
            <option value="observation">Direct observation</option>
            <option value="participant_interpretation">Participant interpretation</option>
            <option value="confirmatory">Confirmatory response</option>
            <option value="contradictory">Contradictory evidence</option>
          </select>
        </Field>
      </div>

      <Field label="Attach to a concept" hint="Optional. Leave this empty if the meaning is still unknown.">
        <select className="select" value={conceptId} onChange={(event) => setConceptId(event.target.value)}>
          <option value="">No concept yet</option>
          {concepts.map((concept) => (
            <option key={concept.id} value={concept.id}>{concept.conceptCode} {concept.agreedMeaning || "Unnamed"}</option>
          ))}
        </select>
      </Field>

      <label className="surface-recessed row" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} style={{ marginTop: 3 }} />
        <span className="small">
          Send this file to the configured AI provider. Leave this off to keep the file on this computer. Demo mode never inspects the file.
        </span>
      </label>

      {stance === "contradictory" ? (
        <Notice tone="warning">Attaching this to a concept reopens it. Earlier checks stay in the history and do not carry over.</Notice>
      ) : null}

      <div className="row-between">
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>
            <Upload size={15} strokeWidth={1.5} aria-hidden="true" />
            {pending ? "Saving the record…" : "Submit evidence"}
          </button>
          {file ? <span className="small muted">Ready to submit ({file.name}).</span> : null}
        </div>
        <span className="small muted">SVG uploads are rejected.</span>
      </div>

      {message ? <Notice>{message}</Notice> : null}
    </form>
  );
}

function ImageDrop({ file, preview, onFile }: { file: File | null; preview: string | null; onFile: (file: File | null) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={over ? "stack-sm drop-ready" : "stack-sm"}
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onFile(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      <Field label="Image file">
        <input className="control" type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
      </Field>
      {preview && preview !== "file" ? <PreviewFrame src={preview} alt={file?.name || "Selected image"} /> : null}
      {file ? (
        <div>
          <button type="button" className="btn btn-sm" onClick={() => onFile(null)}>
            <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
            Remove image
          </button>
        </div>
      ) : (
        <p className="small muted">Drop an image here or choose a file.</p>
      )}
    </div>
  );
}

function CameraCapture({ onCapture }: { onCapture: (file: File | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [live, setLive] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      const stream = video?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function openCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setLive(true);
    } catch {
      setError("Camera permission was denied or no camera is available.");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "camera.png", { type: "image/png" });
      setShot(URL.createObjectURL(blob));
      onCapture(file);
    }, "image/png");
  }

  function retake() {
    if (shot) URL.revokeObjectURL(shot);
    setShot(null);
    onCapture(null);
  }

  return (
    <div className="stack-sm">
      <p className="small">The browser will ask before the camera starts.</p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <video ref={videoRef} playsInline muted className="thumb" style={{ display: live && !shot ? "block" : "none" }} />
      {shot ? <PreviewFrame src={shot} alt="Captured frame" /> : null}
      <div className="row">
        {!live ? <button type="button" className="btn btn-sm" onClick={() => void openCamera()}><Camera size={14} strokeWidth={1.5} aria-hidden="true" /> Open camera</button> : null}
        {live && !shot ? <button type="button" className="btn btn-sm btn-primary" onClick={capture}>Capture</button> : null}
        {shot ? <button type="button" className="btn btn-sm" onClick={retake}>Retake</button> : null}
      </div>
    </div>
  );
}

function DrawingPad({ onSave }: { onSave: (file: File | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState(4);
  const [erase, setErase] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width));
    canvas.height = 220;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg-elev").trim() || "#fcfaf6";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = point(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = size;
    if (erase) {
      context.globalCompositeOperation = "destination-out";
    } else {
      context.globalCompositeOperation = "source-over";
      context.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#1d1915";
    }
    context.beginPath();
    context.moveTo(last.current.x, last.current.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    last.current = next;
  }

  function save() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      onSave(new File([blob], "drawing.png", { type: "image/png" }));
      setSaved(true);
    }, "image/png");
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.globalCompositeOperation = "source-over";
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg-elev").trim() || "#fcfaf6";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setSaved(false);
    onSave(null);
  }

  return (
    <div className="stack-sm">
      <canvas
        ref={canvasRef}
        className="draw"
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={() => { drawing.current = false; last.current = null; }}
        onPointerLeave={() => { drawing.current = false; last.current = null; }}
      />
      <div className="row-between">
        <label className="row small" style={{ gap: 8 }}>
          <span>Brush {size}px</span>
          <input type="range" min={2} max={24} value={size} onChange={(event) => setSize(Number(event.target.value))} />
        </label>
        <div className="row">
          <button type="button" className={erase ? "btn btn-sm is-selected" : "btn btn-sm"} onClick={() => setErase((value) => !value)}>
            <Eraser size={14} strokeWidth={1.5} aria-hidden="true" />
            {erase ? "Erasing" : "Erase"}
          </button>
          <button type="button" className="btn btn-sm" onClick={clear}>Clear</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={save}>Use this drawing</button>
        </div>
      </div>
      {saved ? <p className="small muted" role="status">Drawing is ready to submit. It is not saved until you submit the record.</p> : null}
    </div>
  );
}

function AudioCapture({ file, onFile, onDuration }: { file: File | null; onFile: (file: File | null) => void; onDuration: (ms: number | null) => void }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 200);
    return () => window.clearInterval(timer);
  }, [recording]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      chunks.current = [];
      media.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
        const nextUrl = URL.createObjectURL(blob);
        setUrl(nextUrl);
        onFile(new File([blob], "recording.webm", { type: blob.type }));
      };
      recorder.current = media;
      media.start();
      setRecording(true);
      window.setTimeout(() => {
        if (media.state === "recording") stop();
      }, 60_000);
    } catch {
      setError("Microphone permission was denied or recording is unavailable.");
    }
  }

  function stop() {
    recorder.current?.stop();
    setRecording(false);
  }

  return (
    <div className="stack-sm">
      <p className="small">The browser will ask before the microphone starts. Recording stops automatically after one minute.</p>
      {recording ? <p className="banner recording-live" role="status">Recording {Math.floor(elapsed / 1000)}s. Stops at one minute.</p> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="row">
        {!recording ? (
          <button type="button" className="btn btn-sm" onClick={() => void start()}>
            <Mic size={14} strokeWidth={1.5} aria-hidden="true" />
            Start recording
          </button>
        ) : (
          <button type="button" className="btn btn-sm btn-danger" onClick={stop}>
            <Square size={14} strokeWidth={1.5} aria-hidden="true" />
            Stop recording
          </button>
        )}
        {file ? (
          <button type="button" className="btn btn-sm" onClick={() => { onFile(null); if (url) URL.revokeObjectURL(url); setUrl(null); }}>
            <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
            Delete recording
          </button>
        ) : null}
      </div>
      {url ? <audio controls src={url} onLoadedMetadata={(event) => onDuration(Math.round(event.currentTarget.duration * 1000))} style={{ width: "100%" }} /> : null}
      <Field label="Or upload audio">
        <input className="control" type="file" accept="audio/*,video/webm" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
      </Field>
    </div>
  );
}

function GestureFields({
  actionCategory,
  onAction,
  file,
  onFile,
  direction,
  repetition,
  body,
  onDirection,
  onRepetition,
  onBody,
  onDuration,
  onFrame,
}: {
  actionCategory: string;
  onAction: (value: string) => void;
  file: File | null;
  onFile: (file: File | null) => void;
  direction: string;
  repetition: string;
  body: string;
  onDirection: (value: string) => void;
  onRepetition: (value: string) => void;
  onBody: (value: string) => void;
  onDuration: (ms: number | null) => void;
  onFrame: (file: File, note: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("video/")) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return (
    <div className="stack-sm">
      <div className="grid-2">
        <Field label="Action">
          <select className="select" value={actionCategory} onChange={(event) => onAction(event.target.value)}>
            {ACTION_CATEGORIES.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </Field>
        <Field label="Repetition">
          <select className="select" value={repetition} onChange={(event) => onRepetition(event.target.value)}>
            <option value="once">Once</option>
            <option value="repeated">Repeated</option>
            <option value="held">Held</option>
          </select>
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Direction">
          <input className="control" value={direction} onChange={(event) => onDirection(event.target.value)} />
        </Field>
        <Field label="Body movement">
          <input className="control" value={body} onChange={(event) => onBody(event.target.value)} placeholder="Hand, arm, head, whole body" />
        </Field>
      </div>
      <p className="small muted">
        A short video can be stored. The model does not watch the whole file. Capture one frame if you want a vision model to see a still, and then consent separately.
      </p>
      <Field label="Optional video">
        <input className="control" type="file" accept="video/webm,video/mp4,video/quicktime" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
      </Field>
      {url ? (
        <video
          ref={videoRef}
          className="thumb"
          controls
          src={url}
          onLoadedMetadata={(event) => onDuration(Math.round(event.currentTarget.duration * 1000))}
        />
      ) : null}
      <div className="row">
        {url ? (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              const canvas = document.createElement("canvas");
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 360;
              const context = canvas.getContext("2d");
              if (!context) return;
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              canvas.toBlob((blob) => {
                if (!blob) return;
                onFrame(new File([blob], "selected-frame.png", { type: "image/png" }), "Selected frame from a video. The rest of the video was not analyzed.");
              }, "image/png");
            }}
          >
            Use the current frame as the image
          </button>
        ) : null}
        {file ? <button type="button" className="btn btn-sm" onClick={() => onFile(null)}>Remove video</button> : null}
      </div>
      <p className="small muted">
        Categories include pointing, drinking, movement, direction, and requests. {CATEGORY_LABEL.actions} stay separate from objects when you accept a meaning later.
      </p>
    </div>
  );
}
