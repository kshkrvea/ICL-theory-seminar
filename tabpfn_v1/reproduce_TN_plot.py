import argparse
import os
import torch
import tabpfn

from core.bias_variance import (
    generate_test_data,
    generate_train_data,
    make_prediction,
    make_localised_prediction,
    calculate_bias_variance,
    make_plot,
    save_predictions,
)

TABPFN_TOKEN_ENV_VAR = "TABPFN_TOKEN"
TABPFN_TOKEN = os.environ.get(TABPFN_TOKEN_ENV_VAR, "")

OUTPUT_PLOT_PATH = "../results/bias_variance_plot_v1.png"
OUTPUT_PREDICTIONS_PATH = "../results/predictions/tabpfn_predictions_v1.npz"
OUTPUT_LOC_PREDICTIONS_PATH = "../results/predictions/localized_tabpfn_predictions_v1.npz"


def main() -> None:
    parser = argparse.ArgumentParser(description="Reproduce bias-variance plot with TabPFN v1.")
    parser.add_argument("--device", default="cpu", help="Torch device (e.g. cpu, cuda:0, cuda:1).")
    args = parser.parse_args()

    device = torch.device(args.device)
    print(f"Using device: {device}")

    x_test, _, p0_test = generate_test_data()
    x, y, _ = generate_train_data()

    clf = tabpfn.TabPFNClassifier(device=device)

    predictions = make_prediction(clf, x, y, x_test)
    total_variances, total_squared_biases = calculate_bias_variance(predictions, p0_test)
    save_predictions(predictions, p0_test, OUTPUT_PREDICTIONS_PATH)

    loc_predictions = make_localised_prediction(clf, x, y, x_test)
    loc_variances, loc_squared_biases = calculate_bias_variance(loc_predictions, p0_test)
    save_predictions(loc_predictions, p0_test, OUTPUT_LOC_PREDICTIONS_PATH)

    make_plot(total_variances, total_squared_biases, loc_variances, loc_squared_biases, OUTPUT_PLOT_PATH)


if __name__ == "__main__":
    main()
