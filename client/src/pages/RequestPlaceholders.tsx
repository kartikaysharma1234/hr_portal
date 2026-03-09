import '../styles/request_regularise.css';

interface RequestPlaceholderProps {
  title: string;
}

const RequestPlaceholder = ({ title }: RequestPlaceholderProps): JSX.Element => {
  return (
    <section className="req-shell">
      <header className="req-head">
        <h1>Request</h1>
        <span>{'>'}</span>
        <h2>{title}</h2>
      </header>

      <section className="req-card req-placeholder">
        <h3>{title}</h3>
        <p>This module will be connected next. Attendance Regularise is fully functional now.</p>
      </section>
    </section>
  );
};

export const HelpDeskRequestPage = (): JSX.Element => <RequestPlaceholder title="HelpDesk" />;
export const AppreciationRequestPage = (): JSX.Element => <RequestPlaceholder title="Appreciation" />;
export const ResignationNotePage = (): JSX.Element => <RequestPlaceholder title="Resignation Note" />;
export const LeaveEncashmentPage = (): JSX.Element => <RequestPlaceholder title="Leave Encashment" />;
