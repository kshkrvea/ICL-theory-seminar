import os
import numpy as np
import torch
import tqdm
import matplotlib.pyplot as plt
from data import data_generators

FEATURES_DIM = 5
NUM_DATASETS = 100
TEST_SIZE = 100
FIGSIZE = (12, 5)
FIG_DPI = 200


def generate_test_data():
    dataset_generator = data_generators.NaglerDatasetGenerator(dim=FEATURES_DIM)
    x, y, p0 = dataset_generator.sample(num_samples=TEST_SIZE)
    return x, y, p0


def generate_train_data(sample_sizes):
    dataset_generators = [
        data_generators.NaglerDatasetGenerator(dim=FEATURES_DIM) for _ in range(NUM_DATASETS)
    ]
    x, y, p0 = [], [], []
    for dataset in dataset_generators:
        x_, y_, p0_ = dataset.sample(num_samples=max(sample_sizes))
        x.append(x_)
        y.append(y_)
        p0.append(p0_)

    return torch.stack(x), torch.stack(y), torch.stack(p0)


def make_prediction(clf, x, y, x_test, sample_sizes):
    print("Making predictions with TabPFN...")
    predictions = {}
    for n in sample_sizes:
        print(f"Processing n={n}...")
        predictions[n] = []
        for i in tqdm.tqdm(range(NUM_DATASETS)):
            x_train, y_train = x[i, :n], y[i, :n]
            try:
                clf.fit(x_train, y_train, overwrite_warning=True)
            except TypeError:
                clf.fit(x_train, y_train)
            p0_hat_test = clf.predict_proba(x_test)[..., 0]
            predictions[n].append(p0_hat_test)

    return {n: np.stack(preds) for n, preds in predictions.items()}


def make_localised_prediction(clf, x, y, x_test, sample_sizes, upper_bound_nearest_neighbors=10_000):
    print("Making localized predictions with TabPFN...")
    predictions = {n: [] for n in sample_sizes}
    d = x.shape[-1]

    for n in sample_sizes:
        print(f"Processing n={n}...")
        k_n = round(n * min((n / upper_bound_nearest_neighbors) ** (-d / (d + 4)), 1.0))

        for i in tqdm.tqdm(range(NUM_DATASETS)):
            x_train = x[i, :n]
            y_train = y[i, :n]

            distances = torch.cdist(x_test, x_train)
            _, indices = torch.topk(distances, k_n, largest=False, dim=1)

            x_train_locs = x_train[indices]
            y_train_locs = y_train[indices]

            dataset_preds = []

            for j in range(x_test.shape[0]):
                try:
                    clf.fit(x_train_locs[j], y_train_locs[j], overwrite_warning=True)
                except TypeError:
                    clf.fit(x_train_locs[j], y_train_locs[j])
                p0_hat = clf.predict_proba(x_test[j:j+1])[0, 0]
                dataset_preds.append(p0_hat)

            predictions[n].append(dataset_preds)

    return {n: np.array(preds) for n, preds in predictions.items()}


def calculate_bias_variance(predictions, p0_test):
    averaged_predictions = {n: preds.mean(axis=0) for n, preds in predictions.items()}

    per_point_variances = {
        n: ((predictions[n] - averaged_predictions[n]) ** 2).mean(axis=0) for n in predictions
    }

    per_point_squared_biases = {
        n: ((averaged_predictions[n] - p0_test.numpy()) ** 2) for n in predictions
    }

    total_variances = {n: per_point_variances[n].mean() for n in predictions}
    total_squared_biases = {n: per_point_squared_biases[n].mean() for n in predictions}

    # 95% credible interval half-widths via normal approximation over TEST_SIZE test points
    n_test = next(iter(per_point_variances.values())).shape[0]
    z95 = 1.96
    variance_ci = {n: z95 * per_point_variances[n].std() / np.sqrt(n_test) for n in predictions}
    bias_ci = {n: z95 * per_point_squared_biases[n].std() / np.sqrt(n_test) for n in predictions}

    return total_variances, total_squared_biases, variance_ci, bias_ci


def make_plot(
    total_variances, total_squared_biases,
    loc_variances=None, loc_squared_biases=None,
    output_path="",
    variance_ci=None, bias_ci=None,
    loc_variance_ci=None, loc_bias_ci=None,
):
    plt.figure(figsize=FIGSIZE)

    plt.subplot(1, 2, 1)
    ns = list(total_squared_biases.keys())
    vals = np.array(list(total_squared_biases.values()))
    ci = np.array([bias_ci[n] for n in ns]) if bias_ci is not None else None
    plt.errorbar(ns, vals, yerr=ci, marker="o", label="TabPFN", color="black", capsize=4)
    if loc_squared_biases is not None:
        loc_ns = list(loc_squared_biases.keys())
        loc_vals = np.array(list(loc_squared_biases.values()))
        loc_ci = np.array([loc_bias_ci[n] for n in loc_ns]) if loc_bias_ci is not None else None
        plt.errorbar(loc_ns, loc_vals, yerr=loc_ci, marker="o", label="Localized TabPFN", color="lightskyblue", capsize=4)
    plt.xlabel("Sample Size")
    plt.ylabel("Total Squared Bias")
    plt.title("Average Squared Bias")
    plt.legend()

    plt.subplot(1, 2, 2)
    ns = list(total_variances.keys())
    vals = np.array(list(total_variances.values()))
    ci = np.array([variance_ci[n] for n in ns]) if variance_ci is not None else None
    plt.errorbar(ns, vals, yerr=ci, marker="o", label="TabPFN", color="black", capsize=4)
    if loc_variances is not None:
        loc_ns = list(loc_variances.keys())
        loc_vals = np.array(list(loc_variances.values()))
        loc_ci = np.array([loc_variance_ci[n] for n in loc_ns]) if loc_variance_ci is not None else None
        plt.errorbar(loc_ns, loc_vals, yerr=loc_ci, marker="o", label="Localized TabPFN", color="lightskyblue", capsize=4)
    plt.xlabel("Sample Size")
    plt.ylabel("Total Variance")
    plt.title("Average Variance")
    plt.legend()

    plt.tight_layout()
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    plt.savefig(output_path, dpi=FIG_DPI, bbox_inches="tight")
    print(f"Saved plot to {output_path}")


def save_predictions(predictions, p0_test, output_path, sample_sizes):
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    payload = {f"preds_{n}": preds for n, preds in predictions.items()}
    payload["p0_test"] = p0_test.detach().cpu().numpy()
    payload["sample_sizes"] = np.array(sample_sizes, dtype=int)
    np.savez_compressed(output_path, **payload)
    print(f"Saved predictions to {output_path}")
