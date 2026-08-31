import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import ThemedImage from "@theme/ThemedImage";

export default function Logo({ imageClassName, titleClassName, ...props }: any) {
  const logoSrc = useBaseUrl("img/logo.svg");
  const homeUrl = useBaseUrl("/");

  return (
    <Link
      to={homeUrl}
      {...props}
    >
      <div className={imageClassName}>
        <ThemedImage sources={{ light: logoSrc, dark: logoSrc }} alt="Kondis" />
      </div>
      <b className={titleClassName}>
        <span>Kondis</span>{" "}
        <span className="navbar__title-accent">Developers</span>
      </b>
    </Link>
  );
}
