import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";

export default function Logo({ imageClassName, titleClassName, ...props }: any) {
  const homeUrl = useBaseUrl("/");

  return (
    <Link to={homeUrl} {...props}>
      <span className={imageClassName} role="img" aria-label="sweating face">
        😰
      </span>
      <b className={titleClassName}>Kondis Docs</b>
    </Link>
  );
}
