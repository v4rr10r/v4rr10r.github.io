import { Link } from "react-router-dom";
import RevealSection from "../components/RevealSection.jsx";

function ExtraPage({ posts }) {
  return (
    <div className="page-stack">
      <section className="panel page-hero">
        <p className="eyebrow">Blogs</p>
        <h1>BLOGS</h1>
        <p className="support-copy">
          Lab walkthroughs, techniques, and things I Security Research learned
          along the way.
        </p>
      </section>

      <RevealSection className="notebook-index panel">
        {posts.map((post) => (
          <Link
            className="notebook-index-item"
            key={post.slug}
            to={`/blogs/${post.slug}`}
          >
            <div className="notebook-index-copy">
              <p className="card-kicker">
                {post.collection === "labs" ? "Lab" : "Blog"}
              </p>
              <h2>{post.title}</h2>
              <p className="card-copy">{post.description}</p>
            </div>
            <div className="notebook-index-meta">
              <span>{post.displayDate}</span>
              {post.tags.length ? (
                <div className="card-chip-row">
                  {post.tags.map((tag) => (
                    <span className="chip chip-muted" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </Link>
        ))}
      </RevealSection>
    </div>
  );
}

export default ExtraPage;
