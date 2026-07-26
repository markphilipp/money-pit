import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PALETTE } from '@/lib/palette';
import { ColorPickerPopover } from './ColorPickerPopover';

describe('ColorPickerPopover', () => {
  it('picks a palette color and closes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPickerPopover value={PALETTE[0]} onChange={onChange} ariaLabel="Rule color" />);

    await user.click(screen.getByLabelText('Rule color'));
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(PALETTE.length - 1);

    await user.click(screen.getByLabelText(PALETTE[4]));

    expect(onChange).toHaveBeenCalledWith(PALETTE[4]);
    expect(screen.queryByLabelText(PALETTE[4])).not.toBeInTheDocument();
  });

  it('offers a native color input on the custom tab', async () => {
    const user = userEvent.setup();
    render(<ColorPickerPopover value="#123456" onChange={vi.fn()} ariaLabel="Rule color" />);

    await user.click(screen.getByLabelText('Rule color'));
    await user.click(screen.getByRole('tab', { name: 'Custom' }));

    expect(screen.getByLabelText('Custom color')).toHaveValue('#123456');
  });
});
