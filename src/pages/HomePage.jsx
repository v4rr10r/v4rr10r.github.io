import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import CertificatesCarousel from "../components/CertificatesCarousel.jsx";
import IdentityTerminal from "../components/IdentityTerminal.jsx";
import RevealSection from "../components/RevealSection.jsx";
import SkillsMarquee from "../components/SkillsMarquee.jsx";
import WinsGrid from "../components/WinsGrid.jsx";
import certificates from "../../content/certificates.json";

function HomePage({ extraPosts, siteConfig, writeups }) {
  const pageRef = useRef(null);
  const [activeSection, setActiveSection] = useState("about");
  const stats = [
    {
      label: "CTF Achievements",
      value: String(siteConfig.achievements.length).padStart(2, "0"),
    },
    { label: "Writeups", value: String(writeups.length).padStart(2, "0") },
    { label: "Blog Posts", value: String(extraPosts.length).padStart(2, "0") },
  ];

  useEffect(() => {
    const pageElement = pageRef.current;
    if (!pageElement || typeof IntersectionObserver === "undefined")
      return undefined;
    const visibilityById = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) =>
          visibilityById.set(
            entry.target.dataset.sectionId,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          ),
        );
        const mostVisible = [...visibilityById.entries()].sort(
          (left, right) => right[1] - left[1],
        )[0];
        if (mostVisible?.[1] > 0.24) setActiveSection(mostVisible[0]);
      },
      { rootMargin: "-16% 0px -32% 0px", threshold: [0.2, 0.35, 0.5, 0.7] },
    );
    pageElement
      .querySelectorAll("[data-section-id]")
      .forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const sectionClass = (id) =>
    `flow-section${activeSection === id ? " flow-section-current" : ""}`;

  return (
    <div className="page-stack home-document" ref={pageRef}>
      <RevealSection className="notebook-hero">
        <div className="hero-copy-block">
          <p className="eyebrow">{siteConfig.tagline}</p>
          <h1>{siteConfig.intro.headline}</h1>
          <p className="lead-copy">{siteConfig.intro.description}</p>
          <p className="support-copy">{siteConfig.intro.supporting}</p>
          <div className="cta-row hero-actions">
            <Link className="inline-cta hero-cta-primary" to="/writeups">
              Explore Writeups <span aria-hidden="true">↗</span>
            </Link>
            <Link className="inline-cta hero-cta-secondary" to="/blogs">
              Read Blogs <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div aria-label="Portfolio statistics" className="hero-stats">
          {stats.map((stat) => (
            <div className="hero-stat" key={stat.label}>
              <span className="hero-stat-value">{stat.value}</span>
              <span className="hero-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </RevealSection>

      <RevealSection
        className={sectionClass("about")}
        data-section-id="about"
        id="about"
      >
        <div className="flow-heading">
          <p className="section-index">01 / ABOUT ME</p>
          <h2>Behind the terminal.</h2>
        </div>
        <div className="flow-body">
          <IdentityTerminal />
        </div>
      </RevealSection>

      <RevealSection
        className={sectionClass("skills")}
        data-section-id="skills"
        id="skills"
      >
        <div className="flow-heading">
          <p className="section-index">02 / SKILLS &amp; TOOLS</p>
          <h2>The tools I reach for.</h2>
        </div>
        <div className="flow-body">
          <SkillsMarquee siteConfig={siteConfig} />
        </div>
      </RevealSection>

      <RevealSection
        className={sectionClass("wins")}
        data-section-id="wins"
        id="wins"
      >
        <div className="flow-heading">
          <p className="section-index">03 / ACHIEVEMENTS</p>
          <h2>CTF Hall of Fame.</h2>
        </div>
        <div className="flow-body">
          <WinsGrid achievements={siteConfig.achievements} />
        </div>
      </RevealSection>

      <RevealSection
        className={sectionClass("certifications")}
        data-section-id="certifications"
        id="certifications"
      >
        <div className="flow-heading">
          <p className="section-index">04 / CERTIFICATIONS</p>
          <h2>Credentials &amp; Certifications.</h2>
        </div>
        <div className="flow-body">
          <CertificatesCarousel certificates={certificates} />
        </div>
      </RevealSection>

      <RevealSection
        className={sectionClass("experience")}
        data-section-id="experience"
        id="experience"
      >
        <div className="flow-heading">
          <p className="section-index">05 / EXPERIENCE</p>
          <h2>Where I have contributed.</h2>
        </div>
        <div className="flow-body">
          <div className="experience-list">
            {siteConfig.experience.map((entry) => (
              <a
                className="experience-row experience-link"
                href={entry.url}
                key={`${entry.organization}-${entry.role}`}
                rel="noreferrer"
                target="_blank"
              >
                <div className="experience-main">
                  <p className="timeline-title">{entry.organization}</p>
                  <p className="timeline-role">{entry.role}</p>
                </div>
                <div className="experience-meta">
                  <span className="timeline-period">{entry.period}</span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="experience-link-icon"
                    size={16}
                    strokeWidth={1.7}
                  />
                </div>
              </a>
            ))}
          </div>
        </div>
      </RevealSection>
    </div>
  );
}

export default HomePage;
