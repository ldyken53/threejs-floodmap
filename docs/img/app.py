# from crypt import methods
from flask import jsonify, Flask, send_file, request, make_response
from flask_cors import CORS, cross_origin
from werkzeug.utils import secure_filename
import os

# from vtkmodules.all import (
#     vtkTIFFReader,
# )

import gc
# from vtkmodules.util.numpy_support import vtk_to_numpy
import numpy as np
import json
import subprocess, sys

# from topologytoolkit import (
#     ttkFTMTree,
#     ttkTopologicalSimplificationByPersistence,
#     ttkScalarFieldSmoother
# )


app = Flask(__name__)
app.config["UPLOAD_FOLDER"] = "static/files"

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
target = os.path.join(APP_ROOT, app.config["UPLOAD_FOLDER"])

# pread = vtkTIFFReader()
# pread.SetFileName("./elevation1.tiff")


# extractComponent = vtkImageExtractComponents()
# extractComponent.SetInputConnection(pread.GetOutputPort())
# extractComponent.SetComponents(0)
# extractComponent.Update()

# smoother = ttkScalarFieldSmoother()
# smoother.SetInputConnection(0, pread.GetOutputPort())
# smoother.SetInputArrayToProcess(0, 0, 0, 0, "Tiff Scalars")
# smoother.SetNumberOfIterations(5)
# smoother.Update()

# simplify = ttkTopologicalSimplificationByPersistence()
# simplify.SetInputConnection(0, smoother.GetOutputPort())
# simplify.SetInputArrayToProcess(0, 0, 0, 0, "Tiff Scalars")
# simplify.SetThresholdIsAbsolute(False)
# simplify.SetPersistenceThreshold(50)
# simplify.Update()

# tree = ttkFTMTree()
# tree.SetInputConnection(0, simplify.GetOutputPort())
# tree.SetInputArrayToProcess(0, 0, 0, 0, "Tiff Scalars")
# tree.SetTreeType(2)
# tree.SetWithSegmentation(1)
# tree.Update()

@app.route('/upload', methods=['POST'])
def upload():
    # file = request.files.get("file")
    # fileName = secure_filename(file.filename)
    # destination = "/".join([target, fileName])
    # file.save(destination)
    # args = ['./hmm', destination, 'a.stl', '-z', '500', '-t', '1000000']
    if request.method == 'POST':
        f = request.files['file']
        f.save(secure_filename(f.filename))
        subprocess.check_output(['./hmm', f.filename, 'a.stl', '-z', '500', '-t', '1000000', '--blur', '2'])
        payload = make_response(send_file('a.stl'))
        payload.headers.add('Access-Control-Allow-Origin', '*')
        return payload
    
# @app.route('/test', methods=['POST'])
# def test():
#     response = {"success": "success"}
#     # ranges = [0.02, 0.04, 0.06, 0.08, 0.1]
#     # ranges = [0.02]
#     # for i in ranges:
#     #     simplify.SetPersistenceThreshold(i)
#     #     simplify.Update()
#     #     tree.Update()
#     #     test = vtk_to_numpy(tree.GetOutput(2).GetPointData().GetArray(2))
#     #     response[i] = {'array': test.tolist(), "max": int(np.max(test))}
#     #     del test
#     payload = jsonify(response)
#     payload.headers.add('Access-Control-Allow-Origin', '*')
#     return payload
    
if __name__ == '__main__':
   app.run()