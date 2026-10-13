import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import type { Scenario } from './demo/scenario';

const INTERACTIVE: Scenario = { interactive: true, empty: false, visual: false };
const STATIC: Scenario = { interactive: false, empty: false, visual: false };
const EMPTY: Scenario = { interactive: true, empty: true, visual: false };
const VISUAL: Scenario = { interactive: false, empty: false, visual: true };

describe('App', () => {
  it('§8 the status text is "Selected: none", "Selected: 4 stars", "Selected: 1 star"', async () => {
    const user = userEvent.setup();
    render(<App scenario={INTERACTIVE} />);
    const status = screen.getByTestId('selection');
    expect(status).toHaveTextContent('Selected: none');
    await user.click(screen.getByRole('button', { name: '4 stars: 171 reviews (13.9%)' }));
    expect(status).toHaveTextContent('Selected: 4 stars');
    await user.click(screen.getByRole('button', { name: '1 star: 40 reviews (3.2%)' }));
    expect(status).toHaveTextContent('Selected: 1 star');
  });

  it('§8 the static page renders the widget without buttons or a status', () => {
    render(<App scenario={STATIC} />);
    expect(screen.getByTestId('product-rating')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'widgt demo' })).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('§8 the empty page says "No reviews yet" and stays interactive', () => {
    render(<App scenario={EMPTY} />);
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByTestId('selection')).toHaveTextContent('Selected: none');
  });

  it('§8 the visual page renders the widget without a status', () => {
    render(<App scenario={VISUAL} />);
    expect(screen.getByTestId('product-rating')).toBeInTheDocument();
    expect(screen.queryByTestId('selection')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
