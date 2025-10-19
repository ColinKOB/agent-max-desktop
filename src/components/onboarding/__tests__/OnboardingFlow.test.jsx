/**
 * Unit Tests for OnboardingFlow Component
 * Tests step navigation, payment setup, and completion
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OnboardingFlow } from '../OnboardingFlow';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import useStore from '../../../store/useStore';

// Mock Stripe
jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() => Promise.resolve({
    elements: jest.fn(),
    createPaymentMethod: jest.fn(),
  })),
}));

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => <div>{children}</div>,
  CardElement: () => <div data-testid="card-element">Card Input</div>,
  useStripe: () => ({
    createPaymentMethod: jest.fn(() => Promise.resolve({
      paymentMethod: { id: 'pm_test123' }
    })),
  }),
  useElements: () => ({
    getElement: jest.fn(() => ({})),
  }),
}));

jest.mock('../../../store/useStore');

describe('OnboardingFlow', () => {
  const mockOnComplete = jest.fn();
  const mockOnSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    useStore.mockReturnValue({
      setProfile: jest.fn(),
      profile: { name: 'Test User' },
    });
  });

  test('step navigation', async () => {
    render(
      <OnboardingFlow 
        onComplete={mockOnComplete} 
        onSkip={mockOnSkip} 
      />
    );

    // Step 1: Welcome
    expect(screen.getByText(/welcome to agent max/i)).toBeInTheDocument();
    
    const nextButton = screen.getByRole('button', { name: /get started/i });
    fireEvent.click(nextButton);

    // Step 2: Setup
    await waitFor(() => {
      expect(screen.getByText(/let's get you set up/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/your name/i);
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Step 3: Payment
    await waitFor(() => {
      expect(screen.getByText(/payment method/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Step 4: Complete
    await waitFor(() => {
      expect(screen.getByText(/you're all set/i)).toBeInTheDocument();
    });
  });

  test('skips payment step', async () => {
    render(
      <OnboardingFlow 
        onComplete={mockOnComplete} 
        onSkip={mockOnSkip} 
      />
    );

    // Navigate to payment step
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/let's get you set up/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/your name/i);
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // On payment step
    await waitFor(() => {
      expect(screen.getByText(/payment method/i)).toBeInTheDocument();
    });

    const skipButton = screen.getByRole('button', { name: /skip for now/i });
    fireEvent.click(skipButton);

    // Should go to complete step
    await waitFor(() => {
      expect(screen.getByText(/you're all set/i)).toBeInTheDocument();
    });
  });

  test('completes onboarding', async () => {
    render(
      <OnboardingFlow 
        onComplete={mockOnComplete} 
        onSkip={mockOnSkip} 
      />
    );

    // Navigate through all steps
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/let's get you set up/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/your name/i);
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/payment method/i)).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));

    await waitFor(() => {
      expect(screen.getByText(/you're all set/i)).toBeInTheDocument();
    });

    const finishButton = screen.getByRole('button', { name: /start using agent max/i });
    fireEvent.click(finishButton);

    expect(mockOnComplete).toHaveBeenCalledWith({
      name: 'John Doe',
      paymentMethodId: null,
      skippedPayment: true,
    });
  });

  test('validates required fields', async () => {
    render(
      <OnboardingFlow 
        onComplete={mockOnComplete} 
        onSkip={mockOnSkip} 
      />
    );

    // Go to setup step
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/let's get you set up/i)).toBeInTheDocument();
    });

    // Try to continue without entering name
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  test('can go back to previous step', async () => {
    render(
      <OnboardingFlow 
        onComplete={mockOnComplete} 
        onSkip={mockOnSkip} 
      />
    );

    // Go to step 2
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/let's get you set up/i)).toBeInTheDocument();
    });

    // Go back
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText(/welcome to agent max/i)).toBeInTheDocument();
    });
  });

  test('shows progress indicator', async () => {
    render(
      <OnboardingFlow 
        onComplete={mockOnComplete} 
        onSkip={mockOnSkip} 
      />
    );

    // Step 1
    expect(screen.getByTestId('step-indicator-1')).toHaveClass('active');
    expect(screen.getByTestId('step-indicator-2')).not.toHaveClass('active');

    // Go to step 2
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    
    await waitFor(() => {
      expect(screen.getByTestId('step-indicator-2')).toHaveClass('active');
      expect(screen.getByTestId('step-indicator-1')).toHaveClass('completed');
    });
  });

  test('handles payment method setup', async () => {
    const mockStripe = {
      createPaymentMethod: jest.fn(() => Promise.resolve({
        paymentMethod: { id: 'pm_test123' }
      })),
    };

    render(
      <OnboardingFlow 
        onComplete={mockOnComplete} 
        onSkip={mockOnSkip} 
      />
    );

    // Navigate to payment step
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/let's get you set up/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/your name/i);
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/payment method/i)).toBeInTheDocument();
    });

    // Verify card element is rendered
    expect(screen.getByTestId('card-element')).toBeInTheDocument();
  });

  test('persists data across steps', async () => {
    render(
      <OnboardingFlow 
        onComplete={mockOnComplete} 
        onSkip={mockOnSkip} 
      />
    );

    // Go to step 2 and enter data
    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/let's get you set up/i)).toBeInTheDocument();
    });

    const nameInput = screen.getByPlaceholderText(/your name/i);
    fireEvent.change(nameInput, { target: { value: 'John Doe' } });

    // Go forward then back
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/payment method/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/your name/i)).toHaveValue('John Doe');
    });
  });
});
