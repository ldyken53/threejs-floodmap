import numpy as np
import os

streams = np.load(os.path.abspath("src/python_check/Region_1_GT.npy"), allow_pickle=True)
print(len(streams[0]))