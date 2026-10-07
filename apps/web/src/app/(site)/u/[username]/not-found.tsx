import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <div className="page">
      <h1>No such writer</h1>
      <p className="muted">Nobody on Coscribe has that username.</p>
      <div>
        <Link href="/" className="button">
          Back home
        </Link>
      </div>
    </div>
  );
}
