import { useState } from 'react';
import Icon from './Icon';

// A password <input> with a show/hide toggle. Accepts the same props as a
// plain controlled input (value, onChange, required, minLength, ...).
export default function PasswordInput({ value, onChange, ...rest }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input type={visible ? 'text' : 'password'} value={value} onChange={onChange} {...rest} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
  );
}
