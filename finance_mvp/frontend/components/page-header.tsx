import Link from "next/link";

type Action = {
  href: string;
  label: string;
};

type Props = {
  title: string;
  description?: string;
  actions?: Action[];
};

export default function PageHeader({ title, description, actions = [] }: Props) {
  return (
    <section className="page-header panel">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>

      {actions.length > 0 && (
        <div className="page-header-actions">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="btn secondary">
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
