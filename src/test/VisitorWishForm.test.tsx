import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { VisitorWishForm } from "@/components/VisitorWishForm";

const imageMocks = vi.hoisted(() => ({
  prepareWishImage: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock("@/lib/wish-images", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/wish-images")>()),
  prepareWishImage: imageMocks.prepareWishImage,
}));

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Employee Name"), {
    target: { value: "Aye Aye" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "aye@coca-cola.com.mm" },
  });
  fireEvent.click(screen.getByRole("button", { name: "CDC" }));
  fireEvent.change(screen.getByLabelText("Your Wish Message"), {
    target: { value: "May everyone shine bright tonight" },
  });
}

describe("VisitorWishForm required fields and lantern launch", () => {
  it("requires employee details and a wish before submitting", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<VisitorWishForm onSubmit={onSubmit} onSuccess={vi.fn()} />);

    const form = document.querySelector("form");
    if (!form) throw new Error("Visitor wish form was not rendered.");
    expect(screen.getByLabelText("Employee Name")).toBeRequired();
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByRole("group", { name: "Plant" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your Wish Message")).toBeRequired();

    fireEvent.submit(form);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please enter your name.",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits normalized email without duplicating the fixed domain", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<VisitorWishForm onSubmit={onSubmit} onSuccess={vi.fn()} />);
    fillRequiredFields();

    const form = document.querySelector("form");
    if (!form) throw new Error("Visitor wish form was not rendered.");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        employee_name: "Aye Aye",
        email: "aye@coca-cola.com.mm",
        plant: "CDC",
        message: "May everyone shine bright tonight",
      });
    });
  });

  it("previews, replaces and removes an optional photo before submitting", async () => {
    imageMocks.prepareWishImage
      .mockResolvedValueOnce("data:image/webp;base64,Zmlyc3Q=")
      .mockResolvedValueOnce("data:image/webp;base64,c2Vjb25k")
      .mockResolvedValueOnce("data:image/webp;base64,ZmluYWw=");
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <VisitorWishForm onSubmit={onSubmit} onSuccess={vi.fn()} />,
    );
    fillRequiredFields();
    expect(screen.getByText("(Optional)")).toBeInTheDocument();
    expect(
      screen.getByText(/your wish shines just as brightly without one/i),
    ).toBeInTheDocument();

    const chooseFile = (file: File) => {
      const fileInput =
        container.querySelector<HTMLInputElement>("#wish-photo");
      if (!fileInput) throw new Error("Wish photo input was not rendered.");
      fireEvent.change(fileInput, { target: { files: [file] } });
    };
    chooseFile(new File(["first"], "first.png", { type: "image/png" }));
    const preview = await screen.findByAltText(
      "Preview of the photo attached to your wish",
    );
    expect(preview).toHaveAttribute("src", "data:image/webp;base64,Zmlyc3Q=");

    chooseFile(new File(["second"], "second.webp", { type: "image/webp" }));
    await waitFor(() =>
      expect(preview).toHaveAttribute(
        "src",
        "data:image/webp;base64,c2Vjb25k",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(
      screen.queryByAltText("Preview of the photo attached to your wish"),
    ).not.toBeInTheDocument();

    chooseFile(new File(["final"], "final.jpg", { type: "image/jpeg" }));
    await screen.findByAltText("Preview of the photo attached to your wish");
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ employee_name: "Aye Aye" }),
        "data:image/webp;base64,ZmluYWw=",
      ),
    );
  });

  it.each([
    ["unsupported image type", "Choose a JPG, JPEG, PNG or WEBP image."],
    ["image over 5 MB", "Choose an image that is 5 MB or smaller."],
  ])("shows validation errors for an %s", async (_scenario, message) => {
    imageMocks.prepareWishImage
      .mockReset()
      .mockRejectedValue(new Error(message));
    const { container } = render(
      <VisitorWishForm onSubmit={vi.fn()} onSuccess={vi.fn()} />,
    );
    const fileInput = container.querySelector<HTMLInputElement>("#wish-photo");
    if (!fileInput) throw new Error("Wish photo input was not rendered.");

    fireEvent.change(fileInput, {
      target: {
        files: [new File(["bad"], "invalid.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(
      screen.queryByAltText("Preview of the photo attached to your wish"),
    ).not.toBeInTheDocument();
  });

  it.each(["aye@gmail.com", "aye@other.com"])(
    "rejects an external email %s",
    async (email) => {
      const onSubmit = vi.fn();
      render(<VisitorWishForm onSubmit={onSubmit} onSuccess={vi.fn()} />);
      fillRequiredFields();
      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: email },
      });
      fireEvent.submit(document.querySelector("form")!);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "@coca-cola.com.mm",
      );
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("submits a long wish intact without a textarea maximum", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<VisitorWishForm onSubmit={onSubmit} onSuccess={vi.fn()} />);
    fillRequiredFields();
    const message = "May we all shine with hope and kindness. ".repeat(1000);
    expect(screen.getByLabelText("Your Wish Message")).not.toHaveAttribute(
      "maxlength",
    );
    fireEvent.change(screen.getByLabelText("Your Wish Message"), {
      target: { value: message },
    });
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ message: message.trim() }),
      ),
    );
  });

  it("launches a lantern from the submit button after a successful save", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    render(<VisitorWishForm onSubmit={onSubmit} onSuccess={onSuccess} />);
    fillRequiredFields();
    vi.spyOn(
      HTMLButtonElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({
      x: 100,
      y: 200,
      width: 300,
      height: 60,
      top: 200,
      right: 400,
      bottom: 260,
      left: 100,
      toJSON: () => ({}),
    });

    const form = document.querySelector("form");
    if (!form) throw new Error("Visitor wish form was not rendered.");
    fireEvent.submit(form);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("link", { name: "VIEW THE FESTIVAL SKY" }),
    ).toHaveAttribute("href", "/display");
    const lantern = document.body.querySelector(".wish-launch-lantern");
    expect(lantern).toHaveStyle({ left: "250px", top: "230px" });
  });

  it("does not launch a lantern when saving fails", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Save failed."));
    render(<VisitorWishForm onSubmit={onSubmit} onSuccess={vi.fn()} />);
    fillRequiredFields();

    const form = document.querySelector("form");
    if (!form) throw new Error("Visitor wish form was not rendered.");
    fireEvent.submit(form);

    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed.");
    expect(
      document.body.querySelector(".wish-launch-lantern"),
    ).not.toBeInTheDocument();
  });
});
