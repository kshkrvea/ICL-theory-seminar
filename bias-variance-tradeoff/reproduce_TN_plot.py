import os
from data import data_generators
import numpy as np
import torch
import tabpfn
import tqdm
import matplotlib.pyplot as plt
import logging

TABPFN_TOKEN_ENV_VAR = "TABPFN_TOKEN"
TABPFN_TOKEN = os.environ.get(TABPFN_TOKEN_ENV_VAR, "")

DIM = 5

NUM_DATASETS = 500

TEST_SIZE = 100

SAMPLE_SIZE_POWERS = list(range(8, 13))
SAMPLE_SIZES = [2 ** k for k in SAMPLE_SIZE_POWERS]

DEVICE_NAME = "cuda:0"

OUTPUT_PLOT_PATH = "bias_variance_plot.png"
FIGSIZE = (12, 5)
FIG_DPI = 200


def generate_test_data():
    dataset_generator = data_generators.NaglerDatasetGenerator(dim=DIM)
    x, y, p0 = dataset_generator.sample(num_samples=TEST_SIZE)
    return x, y, p0


def generate_train_data():
    dataset_generators = [
        data_generators.NaglerDatasetGenerator(dim=DIM) for _ in range(NUM_DATASETS)
    ]
    x, y, p0 = [], [], []
    for dataset in dataset_generators:
        x_, y_, p0_ = dataset.sample(num_samples=max(SAMPLE_SIZES))
        x.append(x_)
        y.append(y_)
        p0.append(p0_)
    
    return torch.stack(x), torch.stack(y), torch.stack(p0)


def make_prediction(clf, x, y, p0, x_test):
    predictions = {}
    for n in SAMPLE_SIZES:
        print(f"Processing n={n}...")
        predictions[n] = []
        for i in tqdm.tqdm(range(NUM_DATASETS)):
            x_train, y_train, _ = x[i, :n], y[i, :n], p0[i, :n]
            clf.fit(x_train, y_train)
            p0_hat_test = clf.predict_proba(x_test)[..., 0]
            predictions[n].append(p0_hat_test)

    return {n: np.stack(preds) for n, preds in predictions.items()}


def calculate_bias_variance(predictions, p0_test):
    averaged_predictions = {n: preds.mean(axis=0) for n, preds in predictions.items()}

    variances = {
        n: (predictions[n] - averaged_predictions[n]).mean(axis=0) for n in SAMPLE_SIZES
    }

    biases = {
        n: (averaged_predictions[n] - p0_test.numpy()) for n in SAMPLE_SIZES
    }

    total_variances = {n: variances[n].mean() for n in SAMPLE_SIZES}
    total_biases = {n: biases[n].mean() for n in SAMPLE_SIZES}

    return total_variances, total_biases


def make_plot(total_variances, total_biases):
    plt.figure(figsize=FIGSIZE)

    plt.subplot(1, 2, 1)
    plt.plot(list(total_variances.keys()), list(total_variances.values()), marker="o")
    plt.xlabel("Sample Size")
    plt.ylabel("Total Variance")
    plt.title("Variance vs Sample Size")

    plt.subplot(1, 2, 2)
    plt.plot(list(total_biases.keys()), list(total_biases.values()), marker="o")
    plt.xlabel("Sample Size")
    plt.ylabel("Total Bias")
    plt.title("Bias vs Sample Size")

    plt.tight_layout()
    plt.savefig(OUTPUT_PLOT_PATH, dpi=FIG_DPI, bbox_inches="tight")
    print(f"Saved plot to {OUTPUT_PLOT_PATH}")


def main() -> None:
    device = torch.device(DEVICE_NAME if torch.cuda.is_available() else 'cpu')
    logging.info(f'Using device: {device}')
    
    x_test, _, p0_test = generate_test_data()
    x, y, p0 = generate_train_data()

    clf = tabpfn.TabPFNClassifier(device=device)
    predictions = make_prediction(clf, x, y, p0, x_test)
    
    total_variances, total_biases = calculate_bias_variance(predictions, p0_test)
    make_plot(total_variances, total_biases)


if __name__ == "__main__":
    main()
