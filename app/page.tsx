import Image from "next/image";
import UploadArea from "./components/UploadArea";
import { Fraunces, Work_Sans } from "next/font/google";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const body = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export default function Home() {
  return (
    <div className={`${body.className} min-h-screen bg-[#f6f1ea] text-[#1d1c1a]`}>
      <main className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -left-32 top-24 h-80 w-80 rounded-full bg-[#ffb86c]/40 blur-3xl" />
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-[#7fd1c7]/40 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#f59e8b]/30 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.7),_rgba(255,255,255,0)_55%)]" />
        </div>

        <section className="relative mx-auto flex max-w-6xl flex-col gap-12 px-6 pb-20 pt-16 sm:px-10 lg:px-16">
          <header className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#4b4a45]">
              <span className="rounded-full border border-[#2f2d2b]/20 px-4 py-2">
                Hello Again
              </span>
            </div>
            <h1
              className={`${display.className} max-w-3xl text-4xl leading-tight sm:text-5xl lg:text-6xl`}
            >
              Hello Again <span className="wave">👋</span>
            </h1>
            <p className="text-lg font-medium text-[#3b3a35] sm:text-xl">
              Reconnect with the people already in your city.
            </p>
            <p className="max-w-2xl text-lg leading-relaxed text-[#4b4a45] sm:text-xl">
              Upload your LinkedIn data export once. We pull public location
              signals and build a fresh list of nearby connections so you can
              say hello again.
            </p>

          </header>

          <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-[#1d1c1a]/10 bg-white/70 p-8 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.45)] backdrop-blur">
              <h2
                className={`${display.className} text-2xl text-[#1d1c1a]`}
              >
                The Process
              </h2>
              <ol className="mt-6 space-y-5 text-base text-[#3c3b37]">
                <li className="grid grid-cols-[2.5rem_1fr] items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f59e8b]/30 text-sm font-semibold">
                    1
                  </span>
                  <span>
                    Visit LinkedIn{" "}
                    <a
                      className="font-semibold text-[#1d1c1a] underline decoration-[#1d1c1a]/30 underline-offset-4 transition hover:decoration-[#1d1c1a]"
                      href="https://www.linkedin.com/mypreferences/d/download-my-data"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download Your Data
                    </a>
                    .
                  </span>
                </li>
                <li className="grid grid-cols-[2.5rem_1fr] items-start gap-4">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7fd1c7]/30 text-sm font-semibold">
                    2
                  </span>
                  <div className="space-y-4">
                    <span className="block">
                      Select all boxes in the section that asks for the data
                      you&apos;re most interested in.
                    </span>
                    <div className="overflow-hidden rounded-2xl border border-[#1d1c1a]/10 bg-white/90 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.45)]">
                      <Image
                        src="/select-all-boxes.png"
                        alt="LinkedIn data export selection boxes"
                        width={780}
                        height={480}
                        className="h-auto w-full"
                      />
                    </div>
                  </div>
                </li>
                <li className="grid grid-cols-[2.5rem_1fr] items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffb86c]/30 text-sm font-semibold">
                    3
                  </span>
                  <span>Click “Request new archive”.</span>
                </li>
                <li className="grid grid-cols-[2.5rem_1fr] items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f59e8b]/30 text-sm font-semibold">
                    4
                  </span>
                  <span>
                    Wait for the email: “The first installment of your LinkedIn
                    data archive is ready!”
                  </span>
                </li>
                <li className="grid grid-cols-[2.5rem_1fr] items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7fd1c7]/30 text-sm font-semibold">
                    5
                  </span>
                  <span>Download the ZIP file of your LinkedIn data.</span>
                </li>
                <li className="grid grid-cols-[2.5rem_1fr] items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f59e8b]/30 text-sm font-semibold">
                    6
                  </span>
                  <span>
                    Upload the ZIP to Hello Again to build your city list.
                  </span>
                </li>
              </ol>
            </div>

            <div className="flex flex-col gap-6 lg:h-full">
              <div className="rounded-3xl border border-[#1d1c1a]/10 bg-[#1d1c1a] p-8 text-[#f6f1ea] shadow-[0_30px_60px_-40px_rgba(0,0,0,0.45)]">
                <h3 className={`${display.className} text-2xl`}>
                  What you get
                </h3>
                <ul className="mt-5 space-y-4 text-sm leading-relaxed text-[#e8e2d8]">
                  <li>Curated list of nearby connections with role context.</li>
                  <li>Suggested reconnect scripts for low-pressure outreach.</li>
                  <li>Neighborhood insights to spark a first coffee chat.</li>
                </ul>
              </div>

              <div className="rounded-3xl border border-[#1d1c1a]/10 bg-white/70 p-8 backdrop-blur">
                <h3 className={`${display.className} text-2xl`}>
                  Why it works
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-[#4b4a45]">
                  We turn a dusty LinkedIn archive into a living map of people
                  you already know. Hello again shows you a map of all the
                  people nearby you so you can start creating meaningful
                  conversations and new friends!
                </p>
              </div>
              <div className="hidden rounded-3xl border border-[#1d1c1a]/10 bg-white/60 p-8 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.4)] backdrop-blur lg:flex lg:flex-1 lg:flex-col">
                <h3 className={`${display.className} text-2xl`}>
                  A little hello in motion
                </h3>
                <div className="mt-6 flex flex-1 items-center justify-center rounded-2xl border border-[#1d1c1a]/10 bg-white/80 p-6">
                  <svg
                    viewBox="0 0 420 180"
                    className="h-full w-full max-h-48"
                    role="img"
                    aria-label="Animated graph connection"
                  >
                    <defs>
                      <linearGradient
                        id="graphGlow"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#7fd1c7" />
                        <stop offset="100%" stopColor="#f59e8b" />
                      </linearGradient>
                    </defs>

                    <path
                      className="graph-line"
                      d="M40 120 C90 40, 160 40, 210 90 S320 150, 380 70"
                      stroke="url(#graphGlow)"
                      strokeWidth="3"
                      fill="none"
                      strokeLinecap="round"
                    />
                    <path
                      className="graph-line graph-line--delay"
                      d="M40 50 C110 110, 170 120, 230 90 S320 30, 380 120"
                      stroke="#1d1c1a"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray="6 10"
                      strokeLinecap="round"
                      opacity="0.4"
                    />

                    {[
                      { cx: 40, cy: 120 },
                      { cx: 120, cy: 60 },
                      { cx: 210, cy: 90 },
                      { cx: 300, cy: 130 },
                      { cx: 380, cy: 70 },
                    ].map((node, index) => (
                      <g key={`${node.cx}-${node.cy}`}>
                        <circle
                          cx={node.cx}
                          cy={node.cy}
                          r="10"
                          fill="#1d1c1a"
                          opacity="0.12"
                        />
                        <circle
                          cx={node.cx}
                          cy={node.cy}
                          r="5"
                          fill="#1d1c1a"
                          className={`graph-node graph-node--${index}`}
                        />
                      </g>
                    ))}
                  </svg>
                </div>
                <p className="mt-5 text-xs uppercase tracking-[0.3em] text-[#7b7872]">
                  Local nodes connecting
                </p>
              </div>
            </div>
          </div>

          <section className="flex flex-col gap-6 rounded-[32px] border border-[#1d1c1a]/10 bg-white/80 p-10 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.4)] backdrop-blur sm:p-12">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex flex-col items-center">
                <h2 className={`${display.className} text-3xl`}>
                  Ready to say hello again?
                </h2>
                <p className="mt-3 w-full text-base text-[#4b4a45] sm:text-lg">
                  Start with your LinkedIn export. We’ll handle the rest and
                  send you a fresh, local list in minutes.
                </p>
              </div>
              <div className="w-full">
                <UploadArea />
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.3em] text-[#7b7872]">
              <span>Privacy-first</span>
              <span>Local by design</span>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
