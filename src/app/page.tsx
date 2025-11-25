import Image from "next/image";

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
        Welcome to BJJ Wiki
      </h1>
      <p className="leading-7 [&:not(:first-child)]:mt-6">
        The community-driven Brazilian Jiu-Jitsu technique database.
        Select a category from the sidebar to get started, or search for a technique.
      </p>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <h3 className="text-2xl font-semibold leading-none tracking-tight mb-4">
          Recent Additions
        </h3>
        <p className="text-muted-foreground">
          No techniques added yet. Be the first to contribute!
        </p>
      </div>
    </div>
  );
}
