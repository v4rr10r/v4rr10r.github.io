import { useMemo, useState } from "react";
import ContentCard from "../components/ContentCard.jsx";
import { writeupCtfOptions, writeupTagOptions } from "../data/content.js";

function WriteupsPage({ writeups }) {
  const [selectedCtf, setSelectedCtf] = useState("all");
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortOrder, setSortOrder] = useState("newest");

  const visibleWriteups = useMemo(() => {
    const filtered = writeups.filter((item) => {
      const matchesCtf = selectedCtf === "all" || item.ctfName === selectedCtf;
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => item.tags.includes(tag));

      return matchesCtf && matchesTags;
    });

    return [...filtered].sort((left, right) => {
      if (sortOrder === "oldest") {
        return left.sortTimestamp - right.sortTimestamp;
      }

      return right.sortTimestamp - left.sortTimestamp;
    });
  }, [selectedCtf, selectedTags, sortOrder, writeups]);

  const toggleTag = (tag) => {
    setSelectedTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((currentTag) => currentTag !== tag)
        : [...currentTags, tag],
    );
  };

  return (
    <div className="page-stack writeups-page">
      <section className="panel page-hero">
        <p className="eyebrow">CTF Writeups</p>
        <h1>CTF WRITEUPS</h1>
        {/* <p className="support-copy">
          Drop a new folder into <code>content/writeups/</code>, add a <code>writeup.md</code>, and it shows up here automatically after the next build.
        </p> */}
      </section>

      <section className="panel filter-panel">
        <div className="filter-controls">
          <label className="field-group">
            <span>CTF Name</span>
            <select
              value={selectedCtf}
              onChange={(event) => setSelectedCtf(event.target.value)}
            >
              <option value="all">All CTFs</option>
              {writeupCtfOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="field-group">
            <span>Sort</span>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>

        <div>
          <p className="field-label">Tag Filter</p>
          <div className="tag-filter-row">
            {writeupTagOptions.map((tag) => {
              const active = selectedTags.includes(tag);

              return (
                <button
                  className={`filter-chip${active ? " filter-chip-active" : ""}`}
                  aria-pressed={active}
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  type="button"
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {visibleWriteups.length ? (
        <section className="card-grid writeup-grid">
          {visibleWriteups.map((item) => (
            <ContentCard
              item={item}
              key={item.slug}
              to={`/writeups/${item.slug}`}
            />
          ))}
        </section>
      ) : (
        <section className="panel empty-state">
          <h2>No writeups matched that filter set.</h2>
          <p>
            Try clearing a tag or switching the CTF dropdown back to all
            entries.
          </p>
        </section>
      )}
    </div>
  );
}

export default WriteupsPage;
