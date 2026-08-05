import { GenericForm } from "./generic-form";

export const dynamic = "force-dynamic";

export default async function FormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <GenericForm slug={slug} />;
}
