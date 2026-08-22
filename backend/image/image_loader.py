from multiprocessing.spawn import _main

import numpy as np
from PIL import Image
import io


class ImageLoader:

    def load_from_bytes(self, image_bytes: bytes) -> np.ndarray:
        """
        Convert uploaded image bytes into a NumPy array.

        TODO:
        1. Read the image from the given bytes.
        2. Open it using PIL.
        3. Convert it into a format suitable for our
           Fourier processing.
        4. Convert the resulting image into a NumPy array.
        5. Return the pixel matrix.

        Think about whether we should process:
            - RGB images
            - grayscale images

        For the first version, choose one and explain
        your reasoning.
        """
        image=Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_matrix=np.asarray(image)
        print(img_matrix.shape)
        return self.image_grayscale_converter(img_matrix)

    def image_grayscale_converter(self, image) -> np.ndarray:

        rows, cols = image.shape[:2]
        img_weighted =np.zeros((rows,cols))
        for i in range(rows):
            for j in range(cols):
                gray = 0.2989 * image[i, j][0] + 0.5870 * image[i, j][1] + 0.1140 * image[i, j][2]
                img_weighted[i, j] = gray

        return img_weighted


# def main():
#     with open("backend\\image\\figure1.png","rb") as f:
#         image_bytes=f.read()
#     myloader=ImageLoader()
#     img_arr=myloader.load_from_bytes(image_bytes)
#     print(img_arr.shape)
#     #print(img_arr[100:200,100:200])
# if __name__=="__main__":
#     main()

