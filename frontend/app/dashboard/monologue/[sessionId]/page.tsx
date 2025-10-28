import ViewMonologueRecordingClient from "./ViewMonologueRecordingClient";

type ViewRecordingPageProps = {
  params: {
    sessionId: string;
  };
};

export default function ViewMonologueRecordingPage({ params }: ViewRecordingPageProps) {
  return <ViewMonologueRecordingClient sessionId={params.sessionId} />;
}
