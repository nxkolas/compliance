type TeamMember = {
  initials: string;
  name: string;
  field: string;
};

type TeamPuzzleSectionProps = {
  titleBefore: string;
  titleHighlight: string;
  description: string;
  team: ReadonlyArray<TeamMember>;
};

const puzzlePieces = [
  {
    left: 0,
    width: 315,
    height: 219,
    viewBox: "0 0 315 219",
    fill: "#303962",
    path: "M1.5 1.5H274.805V75.8447C285.019 75.8447 294.814 79.3637 302.036 85.6277C309.259 91.8916 313.316 100.387 313.316 109.246C313.316 118.104 309.259 126.6 302.036 132.864C294.814 139.128 285.019 142.647 274.805 142.647V216.992H1.5V1.5Z",
  },
  {
    left: 273.3,
    width: 315,
    height: 219,
    viewBox: "0 0 315 219",
    fill: "#011262",
    path: "M1.5 1.5H274.805V75.8447C285.019 75.8447 294.814 79.3638 302.036 85.6277C309.259 91.8916 313.316 100.387 313.316 109.246C313.316 118.105 309.259 126.6 302.036 132.864C294.814 139.128 285.019 142.647 274.805 142.647V216.992H1.5V142.647C11.7138 142.647 21.5092 139.128 28.7315 132.864C35.9537 126.6 40.0111 118.105 40.0111 109.246C40.0111 100.387 35.9537 91.8916 28.7315 85.6277C21.5092 79.3638 11.7138 75.8447 1.5 75.8447L1.5 1.5Z",
  },
  {
    left: 546.61,
    width: 277,
    height: 219,
    viewBox: "0 0 277 219",
    fill: "#303962",
    path: "M1.5 1.5H274.805V75.8447C264.591 75.8447 254.796 79.3638 247.573 85.6277C240.351 91.8916 236.294 100.387 236.294 109.246C236.294 118.105 240.351 126.6 247.573 132.864C254.796 139.128 264.591 142.647 274.805 142.647V216.992H1.5V142.647C11.7138 142.647 21.5092 139.128 28.7315 132.864C35.9537 126.6 40.0111 118.105 40.0111 109.246C40.0111 100.387 35.9537 91.8916 28.7315 85.6277C21.5092 79.3638 11.7138 75.8447 1.5 75.8447L1.5 1.5Z",
  },
  {
    left: 780.61,
    width: 315,
    height: 219,
    viewBox: "0 0 315 219",
    fill: "#011262",
    path: "M313.158 217.385L39.8537 216.992L39.962 142.647C29.7482 142.632 19.9579 139.099 12.7447 132.825C5.53163 126.551 1.4866 118.049 1.49951 109.19C1.51241 100.332 5.58219 91.842 12.8135 85.5884C20.0449 79.3349 29.8455 75.8299 40.0593 75.8446L40.1676 1.5L313.472 1.8931L313.364 76.2377C303.15 76.223 293.349 79.728 286.118 85.9815C278.887 92.2351 274.817 100.725 274.804 109.584C274.791 118.442 278.836 126.944 286.049 133.218C293.262 139.492 303.053 143.025 313.266 143.04L313.158 217.385Z",
  },
  {
    left: 1053.61,
    width: 316,
    height: 220,
    viewBox: "0 0 316 220",
    fill: "#303962",
    path: "M312.793 217.984L39.4905 216.99L39.85 142.646C29.6363 142.609 19.858 139.054 12.6661 132.764C5.47421 126.474 1.45791 117.964 1.50075 109.105C1.54359 100.247 5.64205 91.7657 12.8945 85.5281C20.147 79.2905 29.9594 75.8071 40.1731 75.8443L40.5326 1.50022L313.835 2.49438L312.793 217.984Z",
  },
] as const;

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  const surname = parts.pop() ?? "";

  return { givenName: parts.join(" "), surname };
}

export function TeamPuzzleSection({
  titleBefore,
  titleHighlight,
  description,
  team,
}: TeamPuzzleSectionProps) {
  return (
    <section
      id="about"
      className="scroll-mt-24 overflow-hidden bg-[linear-gradient(180deg,#010102_0%,#020A2E_100%)] py-20 lg:h-[851px] lg:py-0"
    >
      <div className="relative mx-auto max-w-[1728px] px-6 sm:px-10 lg:h-full lg:px-0">
        <h2 className="text-center text-3xl font-medium text-white sm:text-4xl lg:absolute lg:inset-x-0 lg:top-[128px] lg:text-[36px] lg:leading-[61px]">
          {titleBefore}{" "}
          <span className="bg-[linear-gradient(90deg,#0073FF_0%,#FFFFFF_100%)] bg-clip-text font-bold text-transparent">
            {titleHighlight}
          </span>
        </h2>

        <p className="mx-auto mt-6 max-w-[1219px] text-center text-base leading-8 text-white/80 sm:text-lg lg:absolute lg:left-1/2 lg:top-[222px] lg:mt-0 lg:w-[1219px] lg:-translate-x-1/2 lg:leading-10">
          {description}
        </p>

        <div className="mt-20 w-full overflow-x-auto pb-8 lg:absolute lg:left-1/2 lg:top-[447.86px] lg:mt-0 lg:w-[1369.61px] lg:-translate-x-1/2 lg:overflow-visible lg:pb-0">
          <div className="relative h-[276px] w-[1369.61px]">
            {puzzlePieces.map((piece, index) => {
              const member = team[index];
              if (!member) return null;

              const { givenName, surname } = splitName(member.name);
              const contentCenter = index < 3 ? 137.5 : 176.5;
              const nameCenter =
                index === 1
                  ? contentCenter + 12
                  : index === 3
                    ? contentCenter - 12
                    : contentCenter;

              return (
                <article
                  key={member.name}
                  className="absolute top-0 h-[276px] text-center text-white"
                  style={{ left: piece.left, width: piece.width }}
                >
                  <svg
                    aria-hidden="true"
                    width={piece.width}
                    height={piece.height}
                    viewBox={piece.viewBox}
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute left-0 top-0"
                  >
                    <path
                      d={piece.path}
                      fill={piece.fill}
                      stroke="white"
                      strokeOpacity="0.62"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>

                  <h3
                    className="absolute top-[72px] z-10 flex w-[275px] -translate-x-1/2 flex-col text-xl font-medium leading-8"
                    style={{ left: nameCenter }}
                  >
                    <span>{givenName}</span>
                    <span>{surname}</span>
                  </h3>
                  <p
                    className="absolute top-[237px] z-10 w-[260px] -translate-x-1/2 whitespace-nowrap text-xl font-medium leading-8"
                    style={{ left: contentCenter }}
                  >
                    {member.field}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
