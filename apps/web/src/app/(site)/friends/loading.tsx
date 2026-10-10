import { Bar, Loading } from "@/components/Skeleton";

export default function FriendsLoading() {
  return (
    <Loading>
      <div className="page">
        <h1>Friends</h1>
        <section className="section">
          <h2>Find writers</h2>
          <div className="row-actions" aria-hidden>
            <input className="input" placeholder="Search by username" disabled />
            <button className="button" disabled>
              Search
            </button>
          </div>
        </section>
        <section className="section">
          <h2>Your friends</h2>
          <ul className="rows">
            {["7rem", "9rem", "6rem"].map((width, i) => (
              <li key={i} className="row">
                <Bar width={width} />
                <Bar width={72} height={32} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Loading>
  );
}
