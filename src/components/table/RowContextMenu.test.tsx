import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkBar } from './BulkBar';
import { RowContextMenu } from './RowContextMenu';

function setup(selected = false) {
  const handlers = {
    onCreateRule: vi.fn(),
    onChangeCategory: vi.fn(),
    onToggleSelect: vi.fn(),
  };
  render(
    <table>
      <tbody>
        <RowContextMenu selected={selected} {...handlers}>
          <tr>
            <td>LOWES #01111</td>
          </tr>
        </RowContextMenu>
      </tbody>
    </table>,
  );
  return { ...handlers, user: userEvent.setup() };
}

describe('RowContextMenu', () => {
  it('offers quick actions on right-click', async () => {
    const { user, onCreateRule } = setup();
    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('LOWES #01111') });

    await user.click(screen.getByRole('menuitem', { name: 'Create rule from transaction' }));
    expect(onCreateRule).toHaveBeenCalled();
  });

  it('passes pointer coordinates to the category picker', async () => {
    const { user, onChangeCategory } = setup();
    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('LOWES #01111') });

    await user.click(screen.getByRole('menuitem', { name: 'Change category…' }));
    expect(onChangeCategory).toHaveBeenCalledWith({ x: expect.any(Number), y: expect.any(Number) });
  });

  it('labels the selection item by current state', async () => {
    const { user, onToggleSelect } = setup(true);
    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('LOWES #01111') });

    await user.click(screen.getByRole('menuitem', { name: 'Deselect row' }));
    expect(onToggleSelect).toHaveBeenCalled();
  });
});

describe('BulkBar', () => {
  it('renders both bulk actions and no clear button', () => {
    render(<BulkBar count={3} onChangeCategory={vi.fn()} onCreateRule={vi.fn()} />);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change category' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create rule' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('renders nothing without a selection', () => {
    const { container } = render(
      <BulkBar count={0} onChangeCategory={vi.fn()} onCreateRule={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
