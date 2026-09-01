import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";

export default function Logo({
  imageClassName,
  titleClassName,
  ...props
}: any) {
  const homeUrl = useBaseUrl("/");

  return (
    <Link to={homeUrl} {...props}>
      <span className={imageClassName} role="img" aria-label="sweating face">
        😰
      </span>
      <b className={titleClassName}>
        <span>Kondis</span>{" "}
        <span className="navbar__title-accent">Developers</span>
      </b>
    </Link>
  );
}
